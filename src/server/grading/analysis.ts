import { normalizeFormula, type Token } from "./tokenizer";
import type { FormulaLocale } from "./types";

/**
 * Static analysis of a formula (no evaluation). Used as structured input for the
 * AI level feedback (logic of the formula) and for the teacher dashboard. The
 * grade itself stays value-based (see gradeSubmission).
 */

export type ReferenceKind = "cell" | "range" | "column-range" | "row-range";
export type AnchorKind = "relative" | "absolute" | "mixed";

export interface FormulaReference {
  /** As written (after normalisation), e.g. `$A$1`, `B2:B10`, `Plan2!A1`. */
  text: string;
  kind: ReferenceKind;
  anchor: AnchorKind;
  /** Sheet qualifier when present. */
  sheet: string | null;
}

export interface FunctionUsage {
  name: string;
  count: number;
}

export type ComplexityLevel = "trivial" | "simple" | "moderate" | "complex";

export interface FormulaAnalysis {
  /** Formula analysed, normalised to English names and ',' separators. */
  normalizedFormula: string;
  locale: "en" | "pt-BR";
  length: number;
  tokenCount: number;
  functions: FunctionUsage[];
  /** Canonical names, sorted, de-duplicated. */
  uniqueFunctions: string[];
  functionCallCount: number;
  /** Functions recalculated on every change (non-deterministic for grading). */
  volatileFunctions: string[];
  references: FormulaReference[];
  referenceCount: number;
  rangeCount: number;
  absoluteReferenceCount: number;
  relativeReferenceCount: number;
  mixedReferenceCount: number;
  crossSheetReferenceCount: number;
  literals: {
    numbers: number[];
    strings: string[];
    booleans: boolean[];
  };
  /** Numeric literals other than 0 and 1 (likely "magic numbers" / hardcoded values). */
  hardcodedNumbers: number[];
  hardcodedLiteralCount: number;
  operators: {
    arithmetic: number;
    comparison: number;
    concatenation: number;
    total: number;
  };
  maxNestingDepth: number;
  /** Heuristic score, see README. */
  complexityScore: number;
  complexity: ComplexityLevel;
  flags: {
    hasCellReferences: boolean;
    onlyLiterals: boolean;
    usesHardcodedNumbers: boolean;
    deepNesting: boolean;
    usesVolatileFunctions: boolean;
    usesAbsoluteReferences: boolean;
  };
}

const VOLATILE = new Set([
  "NOW",
  "TODAY",
  "RAND",
  "RANDBETWEEN",
  "RANDARRAY",
  "OFFSET",
  "INDIRECT",
]);
const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
const COL_RE = /^(\$?)([A-Za-z]{1,3})$/;
const ROW_RE = /^(\$?)(\d+)$/;
const BOOL_CALLS = new Set(["TRUE()", "FALSE()"]);

function anchorOf(flags: boolean[]): AnchorKind {
  if (flags.every(Boolean)) return "absolute";
  if (flags.some(Boolean)) return "mixed";
  return "relative";
}

function mergeAnchors(a: AnchorKind, b: AnchorKind): AnchorKind {
  return a === b ? a : "mixed";
}

interface Part {
  text: string;
  anchors: boolean[];
  type: "cell" | "col" | "row";
}

/** Reads a reference endpoint starting at index i of the significant token list. */
function readPart(tokens: Token[], i: number): { part: Part; next: number } | null {
  const t = tokens[i];
  if (!t) return null;
  if (t.kind === "ident") {
    const cell = CELL_RE.exec(t.text);
    if (cell) {
      return {
        part: { text: t.text, anchors: [cell[1] === "$", cell[3] === "$"], type: "cell" },
        next: i + 1,
      };
    }
    const col = COL_RE.exec(t.text);
    if (col) return { part: { text: t.text, anchors: [col[1] === "$"], type: "col" }, next: i + 1 };
    // "$1" lexes as a single ident (the tokenizer treats '$' as an identifier char).
    const absRow = /^\$(\d+)$/.exec(t.text);
    if (absRow) return { part: { text: t.text, anchors: [true], type: "row" }, next: i + 1 };
  }
  if (t.kind === "number" && ROW_RE.test(t.text)) {
    return { part: { text: t.text, anchors: [false], type: "row" }, next: i + 1 };
  }
  return null;
}

function isPunct(t: Token | undefined, text: string): boolean {
  return t?.kind === "punct" && t.text === text;
}

export function analyzeFormula(formula: string, locale: FormulaLocale = "auto"): FormulaAnalysis {
  const normalized = normalizeFormula(formula, locale);
  const tokens = normalized.tokens.filter((t) => t.kind !== "ws");

  const fnCounts = new Map<string, number>();
  for (const f of normalized.functionCalls) fnCounts.set(f, (fnCounts.get(f) ?? 0) + 1);
  const functions = [...fnCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const uniqueFunctions = functions.map((f) => f.name);

  const references: FormulaReference[] = [];
  const numbers: number[] = [];
  const strings: string[] = [];
  const booleans: boolean[] = [];
  const ops = { arithmetic: 0, comparison: 0, concatenation: 0, total: 0 };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]!;
    const nextIsCall = isPunct(tokens[i + 1], "(");

    // Sheet qualifier: (ident|'quoted') '!'
    let sheet: string | null = null;
    let start = i;
    if ((t.kind === "ident" || t.kind === "sheet") && isPunct(tokens[i + 1], "!")) {
      sheet = t.kind === "sheet" ? t.text.slice(1, -1).replace(/''/g, "'") : t.text;
      start = i + 2;
    }

    if (!(t.kind === "ident" && nextIsCall)) {
      const first = readPart(tokens, start);
      if (first) {
        let end = first.next;
        let second: Part | null = null;
        if (isPunct(tokens[end], ":")) {
          let s2 = end + 1;
          if (
            (tokens[s2]?.kind === "ident" || tokens[s2]?.kind === "sheet") &&
            isPunct(tokens[s2 + 1], "!")
          ) {
            s2 += 2;
          }
          const p2 = readPart(tokens, s2);
          if (p2 && p2.part.type === first.part.type) {
            second = p2.part;
            end = p2.next;
          }
        }
        const valid = second !== null || first.part.type === "cell"; // lone column/row tokens are not references
        if (valid) {
          const kind: ReferenceKind =
            second === null
              ? "cell"
              : first.part.type === "col"
                ? "column-range"
                : first.part.type === "row"
                  ? "row-range"
                  : "range";
          let anchor = anchorOf(first.part.anchors);
          if (second) anchor = mergeAnchors(anchor, anchorOf(second.anchors));
          const text =
            (sheet ? `${tokens[i]!.text}!` : "") +
            first.part.text +
            (second ? `:${second.text}` : "");
          references.push({ text, kind, anchor, sheet });
          i = end - 1;
          continue;
        }
      }
      if (sheet) {
        i = start - 1;
        continue;
      }
    }

    if (t.kind === "number") numbers.push(Number(t.text));
    else if (t.kind === "string") strings.push(t.text.slice(1, -1).replace(/""/g, '"'));
    else if (t.kind === "ident" && BOOL_CALLS.has(t.text)) booleans.push(t.text === "TRUE()");
    else if (t.kind === "punct") {
      const two = t.text + (tokens[i + 1]?.kind === "punct" ? tokens[i + 1]!.text : "");
      if (two === "<=" || two === ">=" || two === "<>") {
        ops.comparison += 1;
        i += 1;
      } else if ("<>=".includes(t.text)) ops.comparison += 1;
      else if (t.text === "&") ops.concatenation += 1;
      else if ("+-*/^%".includes(t.text)) {
        // Unary +/- (after operator, '(' , ',' or at start) is not counted.
        const prev = tokens[i - 1];
        const unary =
          (t.text === "+" || t.text === "-") &&
          (!prev || (prev.kind === "punct" && prev.text !== ")" && prev.text !== "%"));
        if (!unary) ops.arithmetic += 1;
      }
    }
  }
  ops.total = ops.arithmetic + ops.comparison + ops.concatenation;

  const hardcodedNumbers = numbers.filter((n) => n !== 0 && n !== 1);
  const count = (a: AnchorKind) => references.filter((r) => r.anchor === a).length;
  const rangeCount = references.filter((r) => r.kind !== "cell").length;
  const volatileFunctions = uniqueFunctions.filter((f) => VOLATILE.has(f));

  const complexityScore =
    normalized.functionCalls.length * 2 +
    uniqueFunctions.length +
    ops.total +
    Math.max(0, normalized.maxDepth - 1) * 3 +
    references.length * 0.5 +
    (hardcodedNumbers.length + strings.length) * 0.5;
  const rounded = Math.round(complexityScore * 10) / 10;
  const complexity: ComplexityLevel =
    rounded <= 2 ? "trivial" : rounded <= 6 ? "simple" : rounded <= 15 ? "moderate" : "complex";

  return {
    normalizedFormula: normalized.formula,
    locale: normalized.locale,
    length: formula.trim().length,
    tokenCount: tokens.length,
    functions,
    uniqueFunctions,
    functionCallCount: normalized.functionCalls.length,
    volatileFunctions,
    references,
    referenceCount: references.length,
    rangeCount,
    absoluteReferenceCount: count("absolute"),
    relativeReferenceCount: count("relative"),
    mixedReferenceCount: count("mixed"),
    crossSheetReferenceCount: references.filter((r) => r.sheet !== null).length,
    literals: { numbers, strings, booleans },
    hardcodedNumbers,
    hardcodedLiteralCount: hardcodedNumbers.length + strings.length,
    operators: ops,
    maxNestingDepth: normalized.maxDepth,
    complexityScore: rounded,
    complexity,
    flags: {
      hasCellReferences: references.length > 0,
      onlyLiterals: references.length === 0,
      usesHardcodedNumbers: hardcodedNumbers.length > 0,
      deepNesting: normalized.maxDepth > 3,
      usesVolatileFunctions: volatileFunctions.length > 0,
      usesAbsoluteReferences: references.some((r) => r.anchor !== "relative"),
    },
  };
}
