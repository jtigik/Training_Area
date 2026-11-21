import { MAX_COLS, MAX_ROWS, parseAddress, validateAnswers } from "../domain/grid";
import type { AnswerCell, CellAddress, SpreadsheetGrid } from "../domain/types";

/** Célula lida do arquivo, independente da biblioteca de leitura. */
export interface RawCell {
  address: CellAddress;
  /** Valor exibido (número, texto, booleano ou resultado em cache da fórmula). */
  value: string;
  /** Fórmula sem o "=" inicial, quando houver. */
  formula?: string;
}

export interface ImportedSheet {
  name: string;
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
  warnings: string[];
  /** Pronto para salvar (tem pelo menos uma célula de gabarito válida). */
  valid: boolean;
}

export interface XlsxImportResult {
  fileName: string;
  sheets: ImportedSheet[];
  /** Erro fatal (arquivo ilegível), quando houver. */
  error: string | null;
}

/**
 * Convenção de importação (documentada na tela):
 * - cada aba vira um exercício; o nome da aba é o título sugerido;
 * - células com **fórmula** viram o gabarito (resultado esperado = a fórmula);
 * - células com **valor** viram a planilha inicial, bloqueadas para o aluno;
 * - a grade vai até a última linha/coluna usada (limite 50 × 26, A–Z).
 */
export function sheetToExercise(name: string, cells: RawCell[]): ImportedSheet {
  const warnings: string[] = [];
  const grid: SpreadsheetGrid = { rows: 1, cols: 1, cells: {} };
  const answers: Record<CellAddress, AnswerCell> = {};
  let skipped = 0;

  for (const cell of cells) {
    const pos = parseAddress(cell.address);
    if (!pos || pos.row >= MAX_ROWS || pos.col >= MAX_COLS) {
      skipped++;
      continue;
    }
    const formula = cell.formula?.trim();
    const value = cell.value.trim();
    if (!formula && value === "") continue;
    grid.rows = Math.max(grid.rows, pos.row + 1);
    grid.cols = Math.max(grid.cols, pos.col + 1);
    if (formula) {
      answers[cell.address] = { kind: "FORMULA", expected: `=${formula.replace(/^=/, "")}` };
    } else {
      grid.cells[cell.address] = { value, locked: true };
    }
  }

  // Uma linha e uma coluna livres para o aluno trabalhar ao redor do gabarito.
  grid.rows = Math.min(MAX_ROWS, grid.rows + 1);
  grid.cols = Math.min(MAX_COLS, grid.cols + 1);

  if (skipped)
    warnings.push(
      `${skipped} célula(s) fora do limite de ${MAX_ROWS} linhas × ${MAX_COLS} colunas foram ignoradas.`,
    );
  const answerCount = Object.keys(answers).length;
  if (answerCount === 0)
    warnings.push("Nenhuma fórmula encontrada: marque o gabarito na grade antes de salvar.");
  const valid = answerCount > 0 && validateAnswers(grid, answers).length === 0;
  return { name: name.trim() || "Exercício importado", grid, answers, warnings, valid };
}

/** Arquivos .xlsx são ZIP: começam com "PK\x03\x04". */
export function looksLikeXlsx(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer.slice(0, 4));
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

type ExcelValue = unknown;

/** Converte o valor de uma célula do exceljs em texto exibível. */
export function cellText(value: ExcelValue): { value: string; formula?: string } {
  if (value === null || value === undefined) return { value: "" };
  if (typeof value === "number" || typeof value === "boolean") return { value: String(value) };
  if (typeof value === "string") return { value };
  if (value instanceof Date) return { value: value.toISOString().slice(0, 10) };
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.formula === "string" || typeof v.sharedFormula === "string") {
      const result = v.result;
      return {
        value:
          result === undefined || result === null || typeof result === "object"
            ? ""
            : String(result),
        formula: (v.formula as string | undefined) ?? (v.sharedFormula as string),
      };
    }
    if (Array.isArray(v.richText))
      return { value: v.richText.map((r: { text?: string }) => r.text ?? "").join("") };
    if (typeof v.text === "string") return { value: v.text };
    if (v.error) return { value: String(v.error) };
  }
  return { value: String(value) };
}

/** Lê um .xlsx no navegador (exceljs carregado sob demanda). */
export async function parseXlsx(fileName: string, buffer: ArrayBuffer): Promise<XlsxImportResult> {
  if (!looksLikeXlsx(buffer)) {
    return {
      fileName,
      sheets: [],
      error: "O conteúdo do arquivo não é uma planilha .xlsx válida.",
    };
  }
  try {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheets: ImportedSheet[] = [];
    workbook.eachSheet((ws) => {
      const cells: RawCell[] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
          cells.push({ address: cell.address, ...cellText(cell.value) });
        });
      });
      sheets.push(sheetToExercise(ws.name, cells));
    });
    if (sheets.length === 0) return { fileName, sheets, error: "A planilha não tem abas." };
    return { fileName, sheets, error: null };
  } catch {
    return {
      fileName,
      sheets: [],
      error: "Não foi possível ler o arquivo. Ele pode estar corrompido ou protegido por senha.",
    };
  }
}
