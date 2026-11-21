import type { ExerciseDefinition, ExpectedValue, ScalarValue, ValueType } from "./types";

const MS_PER_DAY = 86_400_000;
/** Excel serial of 1970-01-01 (1900 date system, epoch 1899-12-30). */
const UNIX_EPOCH_SERIAL = 25_569;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Converts an ISO date (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM[:SS]`, no timezone:
 * spreadsheet dates are wall-clock values) to an Excel serial number.
 * Valid for dates from 1900-03-01 onwards (Excel's 1900 leap-year bug is not emulated).
 */
export function dateToSerial(iso: string): number {
  const m = ISO_DATE_RE.exec(iso.trim());
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const check = new Date(ms);
  if (check.getUTCDate() !== Number(d) || check.getUTCMonth() !== Number(mo) - 1) {
    throw new Error(`Invalid calendar date: ${iso}`);
  }
  return ms / MS_PER_DAY + UNIX_EPOCH_SERIAL;
}

/** Converts an Excel serial to ISO `YYYY-MM-DD` (time part dropped). */
export function serialToIsoDate(serial: number): string {
  const ms = Math.round((Math.floor(serial) - UNIX_EPOCH_SERIAL) * MS_PER_DAY);
  return new Date(ms).toISOString().slice(0, 10);
}

export function resolveExpectedValue(expected: ExpectedValue): ScalarValue {
  if (typeof expected === "object" && expected !== null) return dateToSerial(expected.date);
  return expected;
}

export function typeOfValue(v: ScalarValue): ValueType {
  return typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string";
}

export type Comparison = "match" | "wrong_value" | "wrong_type";

type CompareRules = Pick<
  ExerciseDefinition,
  "numberTolerance" | "relativeTolerance" | "caseInsensitive" | "trimStrings"
>;

export const DEFAULT_NUMBER_TOLERANCE = 1e-9;

export function compareValues(
  actual: ScalarValue,
  expected: ScalarValue,
  rules: CompareRules = {},
): Comparison {
  if (typeof actual !== typeof expected) return "wrong_type";
  if (typeof actual === "number" && typeof expected === "number") {
    if (!Number.isFinite(actual)) return "wrong_value";
    const abs = Math.max(0, rules.numberTolerance ?? DEFAULT_NUMBER_TOLERANCE);
    const rel = Math.max(0, rules.relativeTolerance ?? 0) * Math.abs(expected);
    return Math.abs(actual - expected) <= Math.max(abs, rel) ? "match" : "wrong_value";
  }
  if (typeof actual === "string" && typeof expected === "string") {
    let a = actual;
    let e = expected;
    if (rules.trimStrings ?? true) {
      a = a.trim();
      e = e.trim();
    }
    if (rules.caseInsensitive) {
      a = a.toLocaleLowerCase("pt-BR");
      e = e.toLocaleLowerCase("pt-BR");
    }
    return a.normalize("NFC") === e.normalize("NFC") ? "match" : "wrong_value";
  }
  return actual === expected ? "match" : "wrong_value";
}

/**
 * Parses a constant typed without '=' the way a pt-BR spreadsheet would:
 * numbers with '.' or ',' decimals, booleans (TRUE/FALSE/VERDADEIRO/FALSO), else text.
 */
export function parseConstant(input: string): ScalarValue {
  const s = input.trim();
  const upper = s.toUpperCase();
  if (upper === "TRUE" || upper === "VERDADEIRO") return true;
  if (upper === "FALSE" || upper === "FALSO") return false;
  if (/^[+-]?\d+([.,]\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s.replace(",", "."));
  return input;
}

/** True when the token text of a numeric/string literal equals the expected value. */
export function literalEqualsExpected(
  literal: { kind: "number" | "string"; text: string },
  expected: ScalarValue,
  rules: CompareRules,
): boolean {
  if (literal.kind === "number") {
    return (
      typeof expected === "number" &&
      compareValues(Number(literal.text), expected, rules) === "match"
    );
  }
  if (typeof expected !== "string") return false;
  const unquoted = literal.text.slice(1, -1).replace(/""/g, '"');
  return compareValues(unquoted, expected, rules) === "match";
}
