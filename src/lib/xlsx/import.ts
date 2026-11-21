import { MAX_COLS, MAX_ROWS, parseAddress, validateAnswers } from "../domain/grid";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "../domain/labels";
import {
  MVP_LEVELS,
  type AnswerCell,
  type CellAddress,
  type Difficulty,
  type MvpLevel,
  type SpreadsheetGrid,
} from "../domain/types";

/** Célula lida do arquivo, independente da biblioteca de leitura. */
export interface RawCell {
  address: CellAddress;
  /** Valor exibido (número, texto, booleano ou resultado em cache da fórmula). */
  value: string;
  /** Fórmula sem o "=" inicial, quando houver. */
  formula?: string;
}

/** Metadados lidos da aba "Dados" do modelo de importação. */
export interface ImportedMeta {
  title?: string;
  level?: MvpLevel;
  difficulty?: Difficulty;
  statement?: string;
  hint?: string;
}

export interface ImportedSheet {
  name: string;
  meta: ImportedMeta;
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
 * Formato alternativo (sem a aba "Dados"):
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
  return { name: name.trim() || "Exercício importado", meta: {}, grid, answers, warnings, valid };
}

const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** "Fundamental" → FUNDAMENTAL (só níveis do MVP). */
export function parseLevel(label: string): MvpLevel | undefined {
  return MVP_LEVELS.find((l) => norm(LEVEL_LABELS[l]) === norm(label) || norm(l) === norm(label));
}

/** "Muito fácil" → VERY_EASY. */
export function parseDifficulty(label: string): Difficulty | undefined {
  const entry = Object.entries(DIFFICULTY_LABELS).find(
    ([code, l]) => norm(l) === norm(label) || norm(code) === norm(label),
  );
  return entry?.[0] as Difficulty | undefined;
}

export interface TemplateSheets {
  /** Pares chave/valor da aba "Dados" (coluna A = chave, B = valor). */
  dados: [string, string][];
  /** Células da aba "Planilha". */
  planilha: RawCell[];
  /** Linhas da aba "Gabarito" (Célula | Resposta), sem o cabeçalho. */
  gabarito: [string, string][];
}

/**
 * Modelo de importação acordado com o QA (e2e/data/xlsx/build_fixtures.py):
 * aba **Dados** (Título, Nível, Dificuldade, Enunciado, Dica), aba **Planilha**
 * (grade inicial, bloqueada para o aluno) e aba **Gabarito** (Célula | Resposta).
 */
export function templateToExercise(t: TemplateSheets): ImportedSheet {
  const warnings: string[] = [];
  const dados = new Map(t.dados.map(([k, v]) => [norm(k), v.trim()]));
  const meta: ImportedMeta = {
    title: dados.get("titulo") || undefined,
    statement: dados.get("enunciado") || undefined,
    hint: dados.get("dica") || undefined,
  };
  const levelText = dados.get("nivel") ?? "";
  meta.level = parseLevel(levelText);
  if (levelText && !meta.level)
    warnings.push(
      `Nível "${levelText}" não disponível no MVP (use Fundamental, Profissional ou Avançado).`,
    );
  const diffText = dados.get("dificuldade") ?? "";
  meta.difficulty = parseDifficulty(diffText);
  if (diffText && !meta.difficulty) warnings.push(`Dificuldade "${diffText}" não reconhecida.`);
  if (!meta.title) warnings.push("Título ausente na aba Dados.");
  if (!meta.statement) warnings.push("Enunciado ausente na aba Dados.");

  const base = sheetToExercise(
    meta.title ?? "Exercício importado",
    t.planilha.map((c) => ({ address: c.address, value: c.value })),
  );
  const answers: Record<CellAddress, AnswerCell> = {};
  let rows = base.grid.rows;
  let cols = base.grid.cols;
  for (const [ref, resposta] of t.gabarito) {
    const pos = parseAddress(ref);
    const expected = resposta.trim();
    if (!pos || !expected) continue;
    answers[ref.trim().toUpperCase()] = expected.startsWith("=")
      ? { kind: "FORMULA", expected }
      : { kind: "VALUE", expected, tolerance: 0 };
    rows = Math.max(rows, Math.min(MAX_ROWS, pos.row + 2));
    cols = Math.max(cols, Math.min(MAX_COLS, pos.col + 2));
  }
  const grid = { ...base.grid, rows, cols };
  const answerIssues = validateAnswers(grid, answers);
  if (Object.keys(answers).length === 0)
    warnings.push("Sem gabarito: preencha a aba Gabarito (Célula | Resposta).");
  else answerIssues.forEach((i) => warnings.push(i.message));
  const valid =
    Object.keys(answers).length > 0 &&
    answerIssues.length === 0 &&
    !!meta.title &&
    !!meta.statement &&
    !!meta.level &&
    !!meta.difficulty;
  return {
    name: meta.title ?? "Exercício importado",
    meta,
    grid,
    answers,
    warnings: [...base.warnings.filter((w) => !w.startsWith("Nenhuma fórmula")), ...warnings],
    valid,
  };
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
    const readCells = (name: string): RawCell[] => {
      const ws = workbook.getWorksheet(name);
      const cells: RawCell[] = [];
      ws?.eachRow({ includeEmpty: false }, (row) =>
        row.eachCell({ includeEmpty: false }, (cell) => {
          cells.push({ address: cell.address, ...cellText(cell.value) });
        }),
      );
      return cells;
    };
    const pairs = (name: string): [string, string][] => {
      const ws = workbook.getWorksheet(name);
      const out: [string, string][] = [];
      ws?.eachRow({ includeEmpty: false }, (row) => {
        const a = cellText(row.getCell(1).value);
        const b = cellText(row.getCell(2).value);
        out.push([a.value, b.formula ? `=${b.formula}` : b.value]);
      });
      return out;
    };
    if (workbook.getWorksheet("Dados") && workbook.getWorksheet("Gabarito")) {
      const gabarito = pairs("Gabarito").filter(([cell]) => norm(cell) !== "celula");
      return {
        fileName,
        sheets: [
          templateToExercise({ dados: pairs("Dados"), planilha: readCells("Planilha"), gabarito }),
        ],
        error: null,
      };
    }
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
