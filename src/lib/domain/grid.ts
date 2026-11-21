import type { AnswerCell, CellAddress, SpreadsheetGrid } from "./types";

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

export function isFormula(value: string): boolean {
  return value.trim().startsWith("=") && value.trim().length > 1;
}

/** Interpreta o texto digitado no gabarito: "=..." é fórmula; o resto, valor. */
export function inferAnswer(text: string, previous?: AnswerCell): AnswerCell | null {
  const expected = text.trim();
  if (expected === "") return null;
  const kind = isFormula(expected) ? "FORMULA" : "VALUE";
  return kind === "VALUE"
    ? { kind, expected: text, tolerance: previous?.tolerance ?? 0 }
    : { kind, expected: text };
}

export function createEmptyGrid(rows = 10, cols = 6): SpreadsheetGrid {
  return { rows, cols, cells: {} };
}

/** Remove células vazias e fora dos limites (ex.: após reduzir a grade). */
export function normalizeGrid(grid: SpreadsheetGrid): SpreadsheetGrid {
  const cells: SpreadsheetGrid["cells"] = {};
  for (const [addr, cell] of Object.entries(grid.cells)) {
    if (!isInsideGrid(addr, grid)) continue;
    if (cell.value.trim() === "" && !cell.locked) continue;
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
    const expected = answer.expected.trim();
    if (expected === "") {
      issues.push({ address, message: `${address}: informe o resultado esperado.` });
    } else if (answer.kind === "FORMULA" && !isFormula(expected)) {
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
