import { isEmptyCell, MAX_COLS, MAX_ROWS, parseAddress, validateAnswers } from "../domain/grid";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "../domain/labels";
import {
  MVP_LEVELS,
  type AnswerCell,
  type CellAddress,
  type CellScalar,
  type Difficulty,
  type MvpLevel,
  type SpreadsheetGrid,
} from "../domain/types";

/** Célula lida do arquivo, independente da biblioteca de leitura. */
export interface RawCell {
  address: CellAddress;
  /** Valor tipado (número, texto, booleano) ou o resultado em cache da fórmula. */
  value: CellScalar;
  /** Fórmula sem o "=" inicial, quando houver. */
  formula?: string;
  /** Célula com data: `value` é o número serial do Excel. */
  date?: boolean;
}

/** Metadados lidos da aba "Dados" do modelo de importação. */
export interface ImportedMeta {
  title?: string;
  level?: MvpLevel;
  difficulty?: Difficulty;
  statement?: string;
  hint?: string;
}

/** Erro de importação, no formato combinado com o Backend 2. */
export interface ImportIssue {
  sheet: string | null;
  row: number | null;
  column: string | null;
  cell: string | null;
  code: string;
  message: string;
}

export interface ImportedSheet {
  name: string;
  meta: ImportedMeta;
  issues: ImportIssue[];
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
  /** Células com data na grade (valor = serial do Excel). */
  dateCells: CellAddress[];
  warnings: string[];
  /** Pronto para salvar (tem pelo menos uma célula de gabarito válida). */
  valid: boolean;
}

export interface XlsxImportResult {
  fileName: string;
  sheets: ImportedSheet[];
  /** true quando o arquivo segue o modelo Dados/Planilha/Gabarito. */
  template: boolean;
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
  const dateCells: CellAddress[] = [];

  for (const cell of cells) {
    const pos = parseAddress(cell.address);
    if (!pos || pos.row >= MAX_ROWS || pos.col >= MAX_COLS) {
      skipped++;
      continue;
    }
    const formula = cell.formula?.trim();
    const value = cell.value;
    if (!formula && isEmptyCell(value)) continue;
    grid.rows = Math.max(grid.rows, pos.row + 1);
    grid.cols = Math.max(grid.cols, pos.col + 1);
    if (formula) {
      answers[cell.address] = {
        kind: "FORMULA",
        expected: { f: `=${formula.replace(/^=/, "")}` },
      };
    } else {
      grid.cells[cell.address] = { value, locked: true };
      if (cell.date) dateCells.push(cell.address);
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
  return {
    name: name.trim() || "Exercício importado",
    meta: {},
    issues: warnings.map((message) => ({
      sheet: name,
      row: null,
      column: null,
      cell: null,
      code: "SHEET_WARNING",
      message,
    })),
    grid,
    answers,
    dateCells,
    warnings,
    valid,
  };
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

export interface GabaritoRow {
  cell: string;
  /** Resposta tipada; fórmula real ou texto iniciado por "=" vira "=..." (string). */
  answer: CellScalar;
  tolerance?: number;
}

export interface TemplateSheets {
  /** Pares chave/valor da aba "Dados" (coluna A = chave, B = valor). */
  dados: [string, string][];
  /** Células da aba "Planilha". */
  planilha: RawCell[];
  /** Linhas da aba "Gabarito" (Célula | Resposta [| Tolerância]), sem o cabeçalho. */
  gabarito: GabaritoRow[];
}

/**
 * Modelo de importação acordado com o QA (e2e/data/xlsx/build_fixtures.py):
 * aba **Dados** (Título, Nível, Dificuldade, Enunciado, Dica), aba **Planilha**
 * (grade inicial, bloqueada para o aluno) e aba **Gabarito** (Célula | Resposta).
 */
export function templateToExercise(t: TemplateSheets): ImportedSheet {
  const issues: ImportIssue[] = [];
  const issue = (
    sheet: string,
    row: number | null,
    column: string | null,
    code: string,
    message: string,
  ) =>
    issues.push({
      sheet,
      row,
      column,
      cell: row && column ? `${column}${row}` : null,
      code,
      message,
    });
  const dadosRows = new Map(t.dados.map(([k, v], i) => [norm(k), { value: v.trim(), row: i + 1 }]));
  const dado = (key: string) => dadosRows.get(key)?.value || undefined;
  const rowOf = (key: string) => dadosRows.get(key)?.row ?? null;
  const meta: ImportedMeta = {
    title: dado("titulo"),
    statement: dado("enunciado"),
    hint: dado("dica"),
  };
  const levelText = dado("nivel") ?? "";
  meta.level = parseLevel(levelText);
  if (!levelText) issue("Dados", null, null, "MISSING_LEVEL", "Nível ausente na aba Dados.");
  else if (!meta.level)
    issue(
      "Dados",
      rowOf("nivel"),
      "B",
      "INVALID_LEVEL",
      `Nível "${levelText}" não disponível no MVP (use Fundamental, Profissional ou Avançado).`,
    );
  const diffText = dado("dificuldade") ?? "";
  meta.difficulty = parseDifficulty(diffText);
  if (!diffText)
    issue("Dados", null, null, "MISSING_DIFFICULTY", "Dificuldade ausente na aba Dados.");
  else if (!meta.difficulty)
    issue(
      "Dados",
      rowOf("dificuldade"),
      "B",
      "INVALID_DIFFICULTY",
      `Dificuldade "${diffText}" não reconhecida.`,
    );
  if (!meta.title) issue("Dados", null, null, "MISSING_TITLE", "Título ausente na aba Dados.");
  if (!meta.statement)
    issue("Dados", null, null, "MISSING_STATEMENT", "Enunciado ausente na aba Dados.");

  const base = sheetToExercise(
    meta.title ?? "Exercício importado",
    t.planilha.map((c) => ({ address: c.address, value: c.value, date: c.date })),
  );
  // No modelo, fórmulas da aba Planilha fazem parte da grade inicial (não do gabarito).
  for (const c of t.planilha) {
    const pos = parseAddress(c.address);
    if (!c.formula || !pos || pos.row >= MAX_ROWS || pos.col >= MAX_COLS) continue;
    base.grid.cells[c.address] = {
      value: { f: `=${c.formula.replace(/^=/, "")}`, ...(c.value !== null ? { v: c.value } : {}) },
      locked: true,
    };
    base.grid.rows = Math.max(base.grid.rows, Math.min(MAX_ROWS, pos.row + 2));
    base.grid.cols = Math.max(base.grid.cols, Math.min(MAX_COLS, pos.col + 2));
  }
  base.warnings
    .filter((w) => !w.startsWith("Nenhuma fórmula"))
    .forEach((w) => issue("Planilha", null, null, "GRID_LIMIT", w));
  const answers: Record<CellAddress, AnswerCell> = {};
  let rows = base.grid.rows;
  let cols = base.grid.cols;
  t.gabarito.forEach(({ cell: ref, answer, tolerance }, i) => {
    const row = i + 2; // linha 1 = cabeçalho
    const pos = parseAddress(ref.trim());
    if (!ref.trim() && isEmptyCell(answer)) return;
    if (!pos) {
      issue("Gabarito", row, "A", "INVALID_CELL", `Referência de célula inválida: "${ref}".`);
      return;
    }
    if (isEmptyCell(answer)) {
      issue(
        "Gabarito",
        row,
        "B",
        "MISSING_ANSWER",
        `${ref.trim().toUpperCase()}: informe a resposta esperada.`,
      );
      return;
    }
    // Na coluna Resposta, texto iniciado por "=" (ou fórmula real) é a fórmula esperada.
    answers[ref.trim().toUpperCase()] =
      typeof answer === "string" && answer.trim().startsWith("=")
        ? { kind: "FORMULA", expected: { f: answer.trim() } }
        : { kind: "VALUE", expected: answer, tolerance: tolerance ?? 0 };
    rows = Math.max(rows, Math.min(MAX_ROWS, pos.row + 2));
    cols = Math.max(cols, Math.min(MAX_COLS, pos.col + 2));
  });
  const grid = { ...base.grid, rows, cols };
  if (Object.keys(answers).length === 0) {
    if (!issues.some((x) => x.sheet === "Gabarito"))
      issue(
        "Gabarito",
        null,
        null,
        "MISSING_ANSWER_KEY",
        "Sem gabarito: preencha a aba Gabarito (Célula | Resposta).",
      );
  } else {
    validateAnswers(grid, answers).forEach((a) =>
      issues.push({
        sheet: "Gabarito",
        row: null,
        column: null,
        cell: a.address || null,
        code: "INVALID_ANSWER",
        message: a.message,
      }),
    );
  }
  return {
    name: meta.title ?? "Exercício importado",
    meta,
    grid,
    answers,
    dateCells: base.dateCells,
    issues,
    warnings: issues.map((x) => x.message),
    valid: issues.length === 0,
  };
}

/** Rascunho pronto para virar exercício (mesmo formato do POST de exercícios). */
export interface ImportDraft {
  title: string;
  statement: string;
  level: MvpLevel;
  difficulty: Difficulty;
  hint: string | null;
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
  /**
   * Células da Planilha que são datas (BE2): o valor fica como serial do Excel
   * (número) e a UI exibe dd/mm/aaaa.
   */
  dateCells: CellAddress[];
}

export interface ImportReport {
  drafts: ImportDraft[];
  errors: ImportIssue[];
}

const fileIssue = (code: string, message: string): ImportIssue => ({
  sheet: null,
  row: null,
  column: null,
  cell: null,
  code,
  message,
});

/**
 * Relatório da importação, no formato do BE2 (preview): rascunhos + erros com
 * aba/linha/coluna/célula. Tudo ou nada: com qualquer erro, nada é criado.
 */
export function buildImportReport(
  parsed: XlsxImportResult,
  allowedLevels?: readonly string[],
): ImportReport {
  if (parsed.error) return { drafts: [], errors: [fileIssue("FILE_UNREADABLE", parsed.error)] };
  if (!parsed.template)
    return {
      drafts: [],
      errors: [
        fileIssue("TEMPLATE_INVALID", "Use o modelo com as abas Dados, Planilha e Gabarito."),
      ],
    };
  const errors: ImportIssue[] = [];
  const drafts: ImportDraft[] = [];
  for (const sheet of parsed.sheets) {
    errors.push(...sheet.issues);
    const { title, statement, level, difficulty, hint } = sheet.meta;
    if (level && allowedLevels && !allowedLevels.includes(level)) {
      errors.push({
        sheet: "Dados",
        row: null,
        column: null,
        cell: null,
        code: "LEVEL_NOT_IN_SET",
        message: `O nível ${LEVEL_LABELS[level]} não faz parte do conjunto de destino.`,
      });
    }
    if (sheet.issues.length === 0 && title && statement && level && difficulty) {
      drafts.push({
        title,
        statement,
        level,
        difficulty,
        hint: hint ?? null,
        grid: sheet.grid,
        answers: sheet.answers,
        dateCells: sheet.dateCells,
      });
    }
  }
  return { drafts: errors.length ? [] : drafts, errors };
}

/** "Aba Gabarito, célula A4: mensagem" — referência legível para o professor. */
export function formatImportIssue(i: ImportIssue): string {
  const where = [
    i.sheet ? `Aba ${i.sheet}` : null,
    i.row ? `linha ${i.row}` : null,
    i.cell ? `célula ${i.cell}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return where ? `${where}: ${i.message}` : i.message;
}

/** Arquivos .xlsx são ZIP: começam com "PK\x03\x04". */
export function looksLikeXlsx(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer.slice(0, 4));
  return b.length === 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

type ExcelValue = unknown;

/** Converte o valor de uma célula do exceljs em valor tipado (+ fórmula, se houver). */
/** Data → número serial do Excel (dias desde 30/12/1899, fração = hora). */
export function toExcelSerial(date: Date): number {
  return Math.round(((date.getTime() - EXCEL_EPOCH) / 86_400_000) * 1e8) / 1e8;
}

/** Número serial do Excel → "dd/mm/aaaa" (pt-BR). */
export function formatExcelDate(serial: number): string {
  const d = new Date(EXCEL_EPOCH + Math.floor(serial) * 86_400_000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function cellContent(value: ExcelValue): {
  value: CellScalar;
  formula?: string;
  date?: boolean;
} {
  if (value === null || value === undefined) return { value: null };
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string")
    return { value };
  if (value instanceof Date) return { value: toExcelSerial(value), date: true };
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.formula === "string" || typeof v.sharedFormula === "string") {
      const result = v.result;
      return {
        value:
          typeof result === "number" || typeof result === "boolean" || typeof result === "string"
            ? result
            : null,
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

/** Texto exibível de uma célula (usado nas abas Dados e no cabeçalho). */
export function cellText(value: ExcelValue): string {
  const c = cellContent(value);
  if (c.date && typeof c.value === "number") return formatExcelDate(c.value);
  return c.value === null ? "" : String(c.value);
}

/** Nomes das abas do i-ésimo exercício do modelo: "Dados", "Dados (2)", ... */
export function templateSheetNames(n: number) {
  const suffix = n === 1 ? "" : ` (${n})`;
  return { dados: `Dados${suffix}`, planilha: `Planilha${suffix}`, gabarito: `Gabarito${suffix}` };
}

/** Lê um .xlsx no navegador (exceljs carregado sob demanda). */
export async function parseXlsx(fileName: string, buffer: ArrayBuffer): Promise<XlsxImportResult> {
  if (!looksLikeXlsx(buffer)) {
    return {
      fileName,
      sheets: [],
      template: false,
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
          cells.push({ address: cell.address, ...cellContent(cell.value) });
        }),
      );
      return cells;
    };
    const pairs = (name: string): [string, string][] => {
      const ws = workbook.getWorksheet(name);
      const out: [string, string][] = [];
      ws?.eachRow({ includeEmpty: false }, (row) => {
        out.push([cellText(row.getCell(1).value), cellText(row.getCell(2).value)]);
      });
      return out;
    };
    const gabarito = (name: string): GabaritoRow[] => {
      const ws = workbook.getWorksheet(name);
      if (!ws) return [];
      const header = ws.getRow(1);
      let tolCol = 0;
      header.eachCell((c, col) => {
        if (norm(cellText(c.value)) === "tolerancia") tolCol = col;
      });
      const out: GabaritoRow[] = [];
      ws.eachRow({ includeEmpty: true }, (row, n) => {
        if (n === 1) return;
        const ref = cellText(row.getCell(1).value);
        const b = cellContent(row.getCell(2).value);
        const tol = tolCol ? cellContent(row.getCell(tolCol).value).value : null;
        out.push({
          cell: ref,
          answer: b.formula ? `=${b.formula.replace(/^=/, "")}` : b.value,
          ...(typeof tol === "number" ? { tolerance: tol } : {}),
        });
      });
      return out;
    };
    if (workbook.getWorksheet("Dados") && workbook.getWorksheet("Gabarito")) {
      const sheets: ImportedSheet[] = [];
      for (let n = 1; workbook.getWorksheet(templateSheetNames(n).dados); n++) {
        const names = templateSheetNames(n);
        const parsed = templateToExercise({
          dados: pairs(names.dados),
          planilha: readCells(names.planilha),
          gabarito: gabarito(names.gabarito),
        });
        // Erros apontam para a aba real do exercício (ex.: "Gabarito (2)").
        parsed.issues = parsed.issues.map((i) => ({
          ...i,
          sheet:
            i.sheet === "Dados"
              ? names.dados
              : i.sheet === "Planilha"
                ? names.planilha
                : i.sheet === "Gabarito"
                  ? names.gabarito
                  : i.sheet,
        }));
        sheets.push(parsed);
      }
      return { fileName, sheets, template: true, error: null };
    }
    const sheets: ImportedSheet[] = [];
    workbook.eachSheet((ws) => {
      sheets.push(sheetToExercise(ws.name, readCells(ws.name)));
    });
    if (sheets.length === 0)
      return { fileName, sheets, template: false, error: "A planilha não tem abas." };
    return { fileName, sheets, template: false, error: null };
  } catch {
    return {
      fileName,
      sheets: [],
      template: false,
      error: "Não foi possível ler o arquivo. Ele pode estar corrompido ou protegido por senha.",
    };
  }
}
