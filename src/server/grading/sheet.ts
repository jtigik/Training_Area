import type { RawCellContent } from "hyperformula";
import { normalizeFormula } from "./tokenizer";
import type { CellInput, GradingLimits, SheetData } from "./types";

export class GradingFailure extends Error {
  constructor(
    readonly kind: "LIMIT" | "EXERCISE",
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GradingFailure";
  }
}

export interface CellPosition {
  row: number;
  col: number;
}

const A1_RE = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/;

/** Parses an A1 address (`B5`, `$B$5`) into zero-based row/col. */
export function parseA1(address: string): CellPosition | null {
  const m = A1_RE.exec(address.trim());
  if (!m) return null;
  const letters = m[1]!.toUpperCase();
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  const row = Number(m[2]) - 1;
  if (row < 0) return null;
  return { row, col: col - 1 };
}

function normalizeCell(value: CellInput, limits: GradingLimits): RawCellContent {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new GradingFailure("EXERCISE", "INVALID_CELL", "Non-finite number in sheet");
    return value;
  }
  if (typeof value === "boolean") return value;
  if (value.length > limits.maxCellTextLength) {
    throw new GradingFailure("LIMIT", "CELL_TEXT_TOO_LONG", "Sheet cell text exceeds limit");
  }
  if (value.trim().startsWith("=")) return normalizeFormula(value, "auto").formula;
  return value;
}

/** Converts SheetData (2D array or A1 map) into a validated, bounded 2D array. */
export function toSheetArray(sheet: SheetData, limits: GradingLimits): RawCellContent[][] {
  const rows: RawCellContent[][] = [];
  let cells = 0;
  const put = (pos: CellPosition, value: CellInput) => {
    if (pos.row >= limits.maxRows || pos.col >= limits.maxColumns) {
      throw new GradingFailure("LIMIT", "SHEET_TOO_LARGE", "Sheet exceeds row/column limits");
    }
    if (value === null || value === undefined || value === "") return;
    cells += 1;
    if (cells > limits.maxCells)
      throw new GradingFailure("LIMIT", "SHEET_TOO_LARGE", "Sheet exceeds cell limit");
    const row = (rows[pos.row] ??= []);
    row[pos.col] = normalizeCell(value, limits);
  };

  if (Array.isArray(sheet)) {
    if (sheet.length > limits.maxRows)
      throw new GradingFailure("LIMIT", "SHEET_TOO_LARGE", "Sheet exceeds row limit");
    sheet.forEach((r, row) => {
      if (!Array.isArray(r))
        throw new GradingFailure("EXERCISE", "INVALID_SHEET", "Sheet rows must be arrays");
      if (r.length > limits.maxColumns) {
        throw new GradingFailure("LIMIT", "SHEET_TOO_LARGE", "Sheet exceeds column limit");
      }
      r.forEach((value, col) => put({ row, col }, value));
    });
  } else if (sheet && typeof sheet === "object") {
    for (const [address, value] of Object.entries(sheet)) {
      const pos = parseA1(address);
      if (!pos)
        throw new GradingFailure("EXERCISE", "INVALID_ADDRESS", `Invalid cell address: ${address}`);
      put(pos, value);
    }
  } else {
    throw new GradingFailure("EXERCISE", "INVALID_SHEET", "Sheet must be a 2D array or an A1 map");
  }

  // Fill holes so HyperFormula receives a dense array.
  const out: RawCellContent[][] = [];
  for (let r = 0; r < rows.length; r += 1) {
    const src = rows[r] ?? [];
    const dense: RawCellContent[] = [];
    for (let c = 0; c < src.length; c += 1) dense.push(src[c] ?? null);
    out.push(dense);
  }
  return out;
}
