/** Helpers for A1-style cell addressing (0-based row/col internally). */

export interface CellPosition {
  row: number;
  col: number;
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA" */
export function columnLabel(col: number): string {
  if (!Number.isInteger(col) || col < 0) {
    throw new RangeError(`Coluna inválida: ${col}`);
  }
  let n = col + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** "A" -> 0, "AA" -> 26. Case-insensitive. */
export function columnIndex(label: string): number {
  if (!/^[A-Za-z]+$/.test(label)) {
    throw new RangeError(`Coluna inválida: ${label}`);
  }
  let n = 0;
  for (const ch of label.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function toA1({ row, col }: CellPosition): string {
  return `${columnLabel(col)}${row + 1}`;
}

const A1_RE = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$/;

export function isA1(address: string): boolean {
  return A1_RE.test(address.trim());
}

export function parseA1(address: string): CellPosition {
  const m = A1_RE.exec(address.trim());
  if (!m) {
    throw new RangeError(`Endereço de célula inválido: ${address}`);
  }
  return { row: Number(m[2]) - 1, col: columnIndex(m[1]) };
}
