import type {
  AnswerCell,
  CellAddress,
  CellScalar,
  CellValue,
  FormulaCell,
  SpreadsheetGrid,
} from "./types";

export const MAX_ROWS = 50;
export const MAX_COLS = 26;

/** 0 → "A", 25 → "Z". */
export function columnLabel(index: number): string {
  if (index < 0 || index >= MAX_COLS) throw new RangeError(`Coluna fora do limite: ${index}`);
  return String.fromCharCode(65 + index);
}

/** (linha 0-based, coluna 0-based) → "A1". */
export function toAddress(row: number, col: number): CellAddress {
  return `${columnLabel(col)}${row + 1}`;
}

const ADDRESS_RE = /^([A-Z])([1-9][0-9]*)$/;

export function parseAddress(address: CellAddress): { row: number; col: number } | null {
  const match = ADDRESS_RE.exec(address.trim().toUpperCase());
  if (!match) return null;
  return { col: match[1].charCodeAt(0) - 65, row: Number(match[2]) - 1 };
}

export function isInsideGrid(address: CellAddress, grid: Pick<SpreadsheetGrid, "rows" | "cols">) {
  const pos = parseAddress(address);
  return !!pos && pos.row < grid.rows && pos.col < grid.cols;
}

export function isFormulaCell(value: CellValue | undefined): value is FormulaCell {
  return typeof value === "object" && value !== null && typeof value.f === "string";
}

/** Célula sem conteúdo (null, ausente ou texto vazio). */
export function isEmptyCell(value: CellValue | undefined): boolean {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

const NUMBER_RE = /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?$/;
const TRUE_RE = /^(true|verdadeiro)$/i;
const FALSE_RE = /^(false|falso)$/i;

/**
 * Texto digitado no editor → célula tipada:
 * vazio → null; `'texto` → string sem o apóstrofo (força texto, como no Excel);
 * `=...` → `{ f }`; número (aceita vírgula decimal) → number; TRUE/FALSE
 * (ou VERDADEIRO/FALSO) → boolean; o resto → string.
 */
export function parseCellInput(text: string): CellValue {
  if (text.startsWith("'")) return text.slice(1);
  const t = text.trim();
  if (t === "") return null;
  if (t.startsWith("=") && t.length > 1) return { f: t };
  if (NUMBER_RE.test(t)) return Number(t.replace(",", "."));
  if (TRUE_RE.test(t)) return true;
  if (FALSE_RE.test(t)) return false;
  return text;
}

/** Célula tipada → texto do editor (inverso de `parseCellInput`). */
export function formatCellInput(value: CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (isFormulaCell(value)) return value.f;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  // Texto que seria lido como outro tipo ganha apóstrofo para continuar texto.
  if (value === "") return "";
  const parsed = parseCellInput(value);
  return parsed === value ? value : `'${value}`;
}

/** Interpreta o texto digitado no gabarito: "=..." é fórmula; o resto, valor tipado. */
export function inferAnswer(text: string, previous?: AnswerCell): AnswerCell | null {
  const expected = parseCellInput(text);
  if (isEmptyCell(expected)) return null;
  return isFormulaCell(expected)
    ? { kind: "FORMULA", expected }
    : { kind: "VALUE", expected, tolerance: previous?.tolerance ?? 0 };
}

/** Normaliza um valor literal vindo de fora (ex.: formulário) para CellScalar. */
export function toScalar(value: unknown): CellScalar {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string")
    return value;
  return String(value);
}

export function createEmptyGrid(rows = 10, cols = 6): SpreadsheetGrid {
  return { rows, cols, cells: {} };
}

/** Remove células vazias e fora dos limites (ex.: após reduzir a grade). */
export function normalizeGrid(grid: SpreadsheetGrid): SpreadsheetGrid {
  const cells: SpreadsheetGrid["cells"] = {};
  for (const [addr, cell] of Object.entries(grid.cells)) {
    if (!isInsideGrid(addr, grid)) continue;
    if (isEmptyCell(cell.value) && !cell.locked) continue;
    cells[addr] = { value: cell.value, locked: cell.locked };
  }
  return { rows: grid.rows, cols: grid.cols, cells };
}

export interface AnswerIssue {
  address: CellAddress;
  message: string;
}

/**
 * Valida o gabarito contra a grade (TA-016): ao menos uma célula,
 * dentro da grade, com valor esperado preenchido e fórmula começando por "=".
 */
export function validateAnswers(
  grid: SpreadsheetGrid,
  answers: Record<CellAddress, AnswerCell>,
): AnswerIssue[] {
  const issues: AnswerIssue[] = [];
  const entries = Object.entries(answers);
  if (entries.length === 0) {
    issues.push({ address: "", message: "Defina pelo menos uma célula de gabarito." });
    return issues;
  }
  for (const [address, answer] of entries) {
    if (!isInsideGrid(address, grid)) {
      issues.push({ address, message: `${address} está fora da grade.` });
      continue;
    }
    const expected = answer.expected;
    if (isEmptyCell(expected)) {
      issues.push({ address, message: `${address}: informe o resultado esperado.` });
    } else if (
      (answer.kind === "FORMULA") !== isFormulaCell(expected) ||
      (isFormulaCell(expected) && !/^=.+/.test(expected.f.trim()))
    ) {
      issues.push({ address, message: `${address}: a fórmula esperada deve começar com "=".` });
    }
    if (
      answer.tolerance !== undefined &&
      (Number.isNaN(answer.tolerance) || answer.tolerance < 0)
    ) {
      issues.push({ address, message: `${address}: tolerância deve ser zero ou positiva.` });
    }
    if (grid.cells[address]?.locked) {
      issues.push({ address, message: `${address}: célula de gabarito não pode estar bloqueada.` });
    }
  }
  return issues;
}

export type Direction = "up" | "down" | "left" | "right";

/** Navegação por teclado na grade, presa aos limites. */
export function moveFocus(
  row: number,
  col: number,
  dir: Direction,
  grid: Pick<SpreadsheetGrid, "rows" | "cols">,
): { row: number; col: number } {
  switch (dir) {
    case "up":
      return { row: Math.max(0, row - 1), col };
    case "down":
      return { row: Math.min(grid.rows - 1, row + 1), col };
    case "left":
      return { row, col: Math.max(0, col - 1) };
    case "right":
      return { row, col: Math.min(grid.cols - 1, col + 1) };
  }
}
