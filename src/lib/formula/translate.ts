import { ptPT } from "hyperformula/i18n/languages";

/**
 * Students may type formulas the way pt-BR Excel shows them
 * (`=SOMA(A1:A3)`, `=SE(A1>10;"sim";"não")`, `=ARRED(B1;2)`, `1,5`)
 * or in English (`=SUM(A1:A3)`). HyperFormula runs with its canonical
 * English names and `,` as argument separator, so we normalise here.
 */

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const PT_TO_EN: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const functions = ptPT.functions as Record<string, string>;
  for (const [en, pt] of Object.entries(functions)) {
    const upper = pt.toUpperCase();
    if (!map.has(upper)) map.set(upper, en);
    const plain = stripAccents(upper);
    if (!map.has(plain)) map.set(plain, en);
  }
  // pt-BR spellings that differ from pt-PT or are common variants.
  const extra: Record<string, string> = {
    "CONT.NUM": "COUNT",
    "CONTAR.VAZIO": "COUNTBLANK",
    MEDIA: "AVERAGE",
  };
  for (const [pt, en] of Object.entries(extra)) map.set(pt, en);
  return map;
})();

/** Translate a single function name (pt-BR or English) to HyperFormula's canonical name. */
export function toCanonicalFunctionName(name: string): string {
  const upper = name.toUpperCase();
  return PT_TO_EN.get(upper) ?? PT_TO_EN.get(stripAccents(upper)) ?? upper;
}

/** Names of functions referenced in a formula (already canonical), in order of appearance. */
export function referencedFunctions(formula: string): string[] {
  const names: string[] = [];
  forEachCodeSegment(formula, (segment) => {
    for (const m of segment.matchAll(FUNCTION_RE)) names.push(m[1].toUpperCase());
    return segment;
  });
  return names;
}

// Letters (incl. accented), digits, dots and underscores, followed by "(".
const FUNCTION_RE = /([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_.]*)\s*(?=\()/g;

/** Apply `fn` to every part of the formula that is outside string literals. */
function forEachCodeSegment(formula: string, fn: (segment: string) => string): string {
  let out = "";
  let i = 0;
  while (i < formula.length) {
    const quote = formula.indexOf('"', i);
    if (quote === -1) {
      out += fn(formula.slice(i));
      break;
    }
    out += fn(formula.slice(i, quote));
    // find end of string literal ("" is an escaped quote)
    let j = quote + 1;
    while (j < formula.length) {
      if (formula[j] === '"') {
        if (formula[j + 1] === '"') {
          j += 2;
          continue;
        }
        break;
      }
      j++;
    }
    out += formula.slice(quote, Math.min(j + 1, formula.length));
    i = j + 1;
  }
  return out;
}

/**
 * Normalise user input for HyperFormula. Non-formulas (not starting with "=")
 * are returned unchanged, except that pt-BR decimal numbers ("1,5") become "1.5".
 */
export function normalizeFormula(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("=")) {
    return /^-?\d+,\d+$/.test(trimmed) ? trimmed.replace(",", ".") : input;
  }
  const ptBrSeparators = trimmed.includes(";");
  return forEachCodeSegment(trimmed, (segment) => {
    let s = segment.replace(FUNCTION_RE, (_m, name: string) => toCanonicalFunctionName(name));
    if (ptBrSeparators) {
      // In pt-BR style, "," is the decimal mark and ";" separates arguments.
      s = s.replace(/(\d),(\d)/g, "$1.$2").replace(/;/g, ",");
    }
    // Bare boolean literals (pt-BR or English): HyperFormula only knows TRUE()/FALSE().
    s = s.replace(
      /(^|[^A-Za-zÀ-ÿ0-9_.$"])(VERDADEIRO|TRUE|FALSO|FALSE)(?![A-Za-zÀ-ÿ0-9_.(])/gi,
      (_m, pre: string, word: string) =>
        `${pre}${/^(VERDADEIRO|TRUE)$/i.test(word) ? "TRUE" : "FALSE"}()`,
    );
    return s;
  });
}
