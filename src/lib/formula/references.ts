import { parseA1, toA1 } from "./a1";

const REF_RE = /(\$?[A-Za-z]{1,3}\$?[1-9][0-9]*)(?::(\$?[A-Za-z]{1,3}\$?[1-9][0-9]*))?/g;

/**
 * Cells referenced by a formula (single refs and ranges, outside string literals),
 * clipped to `limits`. Used to highlight the ranges in the grid while typing.
 */
export function referencedCells(
  formula: string,
  limits: { rows: number; cols: number },
): Set<string> {
  const out = new Set<string>();
  if (!formula.trim().startsWith("=")) return out;
  const code = formula.replace(/"(?:[^"]|"")*"?/g, '""');
  for (const m of code.matchAll(REF_RE)) {
    const before = code[(m.index ?? 0) - 1];
    // Skip function names like LOG10( or parts of identifiers.
    if (before && /[A-Za-z0-9_.]/.test(before)) continue;
    if (code[(m.index ?? 0) + m[0].length] === "(") continue;
    const a = parseA1(m[1]);
    const b = m[2] ? parseA1(m[2]) : a;
    const r0 = Math.min(a.row, b.row);
    const r1 = Math.min(Math.max(a.row, b.row), limits.rows - 1);
    const c0 = Math.min(a.col, b.col);
    const c1 = Math.min(Math.max(a.col, b.col), limits.cols - 1);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) out.add(toA1({ row, col }));
    }
  }
  return out;
}
