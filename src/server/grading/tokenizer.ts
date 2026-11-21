import { canonicalFunctionName } from "./functions";
import type { FormulaLocale } from "./types";

/**
 * Small, dependency-free lexer for spreadsheet formulas. It is NOT a full parser
 * (HyperFormula does the real parsing); it exists to:
 *  - find function calls while ignoring string literals and quoted sheet names;
 *  - translate pt-BR function names to English;
 *  - normalise pt-BR separators (';' arguments, ',' decimals);
 *  - turn bare TRUE/FALSE (VERDADEIRO/FALSO) into TRUE()/FALSE(), which HyperFormula requires.
 */

export type TokenKind = "string" | "sheet" | "ident" | "number" | "error" | "ws" | "punct";

export interface Token {
  kind: TokenKind;
  text: string;
}

const IDENT_START = /[A-Za-z_$\u00C0-\u024F]/;
const IDENT_PART = /[A-Za-z0-9_.$\u00C0-\u024F]/;
const NUMBER_RE = /^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/;
const ERROR_RE = /^#[A-Za-z0-9/]+[!?]?/;
const WS_RE = /^\s+/;

/** Tokenizes a formula body (without the leading '='). Never throws. */
export function tokenize(body: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i]!;
    const rest = body.slice(i);
    if (ch === '"' || ch === "'") {
      // String literal or quoted sheet name; a doubled quote is an escaped quote.
      let j = i + 1;
      while (j < body.length) {
        if (body[j] === ch) {
          if (body[j + 1] === ch) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      if (j > body.length) j = body.length;
      tokens.push({ kind: ch === '"' ? "string" : "sheet", text: body.slice(i, j) });
      i = j;
      continue;
    }
    const ws = WS_RE.exec(rest);
    if (ws) {
      tokens.push({ kind: "ws", text: ws[0] });
      i += ws[0].length;
      continue;
    }
    const num = NUMBER_RE.exec(rest);
    if (num) {
      tokens.push({ kind: "number", text: num[0] });
      i += num[0].length;
      continue;
    }
    if (ch === "#") {
      const err = ERROR_RE.exec(rest);
      if (err) {
        tokens.push({ kind: "error", text: err[0] });
        i += err[0].length;
        continue;
      }
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < body.length && IDENT_PART.test(body[j]!)) j += 1;
      tokens.push({ kind: "ident", text: body.slice(i, j) });
      i = j;
      continue;
    }
    tokens.push({ kind: "punct", text: ch });
    i += 1;
  }
  return tokens;
}

export interface NormalizedFormula {
  /** Formula with leading '=', English function names and ',' separators. */
  formula: string;
  tokens: Token[];
  /** Canonical function names in order of appearance (may repeat). */
  functionCalls: string[];
  /** Locale effectively applied. */
  locale: "en" | "pt-BR";
  /** Maximum parenthesis nesting depth. */
  maxDepth: number;
  /** A decimal comma was inferred outside function arguments in auto mode without ';'. */
  decimalCommaHeuristic: boolean;
}

function nextNonWs(tokens: Token[], from: number): Token | undefined {
  for (let k = from; k < tokens.length; k += 1) {
    if (tokens[k]!.kind !== "ws") return tokens[k];
  }
  return undefined;
}

function usesSemicolonSeparator(tokens: Token[]): boolean {
  let braces = 0;
  for (const t of tokens) {
    if (t.kind !== "punct") continue;
    if (t.text === "{") braces += 1;
    else if (t.text === "}") braces = Math.max(0, braces - 1);
    else if (t.text === ";" && braces === 0) return true;
  }
  return false;
}

const BOOLEAN_LITERALS: Record<string, string> = {
  TRUE: "TRUE()",
  FALSE: "FALSE()",
  VERDADEIRO: "TRUE()",
  FALSO: "FALSE()",
};

/**
 * Normalises a formula (must start with '=') into the dialect evaluated by the
 * engine: English function names, ',' argument separator, '.' decimal separator.
 */
export function normalizeFormula(
  formula: string,
  locale: FormulaLocale = "auto",
): NormalizedFormula {
  const body = formula.trim().replace(/^=/, "");
  const input = tokenize(body);
  const ptMode = locale === "pt-BR" || (locale === "auto" && usesSemicolonSeparator(input));

  const out: Token[] = [];
  const functionCalls: string[] = [];
  let braces = 0;
  let depth = 0;
  let maxDepth = 0;
  /** For each open parenthesis: true when it opens a function call. */
  const parens: boolean[] = [];
  let pendingCall = false;
  let decimalCommaHeuristic = false;

  for (let k = 0; k < input.length; k += 1) {
    const t = input[k]!;
    if (t.kind === "punct") {
      if (t.text === "{") braces += 1;
      if (t.text === "}") braces = Math.max(0, braces - 1);
      if (t.text === "(") {
        maxDepth = Math.max(maxDepth, ++depth);
        parens.push(pendingCall);
      }
      if (t.text === ")") {
        depth = Math.max(0, depth - 1);
        parens.pop();
      }
      pendingCall = false;
      if (ptMode && braces === 0 && t.text === ";") {
        out.push({ kind: "punct", text: "," });
        continue;
      }
      out.push(t);
      continue;
    }
    // In auto mode without ';', a comma between digits can only be a decimal separator when it is
    // NOT inside a function call's argument list (top level or a grouping parenthesis), e.g.
    // =A1*0,975 or =(A1+A2)*1,5. Inside a call (=ROUND(A1,2)) it stays an argument separator.
    const commaIsDecimal =
      ptMode ||
      (locale === "auto" &&
        braces === 0 &&
        (parens.length === 0 || parens[parens.length - 1] === false));
    if (t.kind === "number" && commaIsDecimal) {
      // Decimal comma: 1,5 -> 1.5 (only digits directly around the comma).
      const comma = input[k + 1];
      const frac = input[k + 2];
      if (
        comma?.kind === "punct" &&
        comma.text === "," &&
        frac?.kind === "number" &&
        !t.text.includes(".") &&
        /^\d/.test(frac.text)
      ) {
        out.push({ kind: "number", text: `${t.text}.${frac.text}` });
        if (!ptMode) decimalCommaHeuristic = true;
        k += 2;
        continue;
      }
      out.push(t);
      continue;
    }
    if (t.kind === "ident") {
      const next = nextNonWs(input, k + 1);
      const prev = out[out.length - 1];
      const isSheetQualifier = next?.kind === "punct" && next.text === "!";
      const isQualified = prev?.kind === "punct" && prev.text === "!";
      if (next?.kind === "punct" && next.text === "(") {
        pendingCall = true;
        const canonical = canonicalFunctionName(t.text);
        functionCalls.push(canonical);
        out.push({ kind: "ident", text: canonical });
        continue;
      }
      const bool = BOOLEAN_LITERALS[t.text.toUpperCase()];
      if (bool && !isSheetQualifier && !isQualified) {
        out.push({ kind: "ident", text: bool });
        continue;
      }
    }
    out.push(t);
  }

  return {
    formula: `=${out.map((t) => t.text).join("")}`,
    tokens: out,
    functionCalls,
    locale: ptMode ? "pt-BR" : "en",
    maxDepth,
    decimalCommaHeuristic,
  };
}
