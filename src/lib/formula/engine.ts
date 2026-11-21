import { DetailedCellError, HyperFormula, type RawCellContent } from "hyperformula";
import { parseA1, toA1 } from "./a1";
import { normalizeFormula, referencedFunctions } from "./translate";

/**
 * HyperFormula is dual-licensed (GPL-3.0 or commercial). "gpl-v3" means the
 * application that ships it must comply with GPL-3.0. Replace with a
 * commercial key via NEXT_PUBLIC_HYPERFORMULA_LICENSE if one is purchased.
 */
export const HYPERFORMULA_LICENSE_KEY = process.env.NEXT_PUBLIC_HYPERFORMULA_LICENSE ?? "gpl-v3";

export type CellInput = string | number | boolean | null;
export type CellMap = Record<string, CellInput>;

export type EvaluatedValue =
  | { kind: "empty" }
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "error"; code: string; message: string };

const SHEET = "Planilha1";

const SUPPORTED_FUNCTIONS: ReadonlySet<string> = new Set(
  HyperFormula.getRegisteredFunctionNames("enGB"),
);

const ERROR_MESSAGES: Record<string, string> = {
  DIV_BY_ZERO: "Divisão por zero (#DIV/0!).",
  NAME: "Nome de função ou intervalo não reconhecido (#NOME?).",
  VALUE: "Tipo de valor incompatível com a operação (#VALOR!).",
  REF: "Referência de célula inválida (#REF!).",
  NUM: "Número inválido para esta função (#NÚM!).",
  NA: "Valor não disponível (#N/D).",
  CYCLE: "Referência circular: a fórmula depende dela mesma.",
  SPILL: "O resultado não cabe nas células vizinhas.",
  ERROR: "Fórmula inválida. Verifique parênteses, separadores e aspas.",
};

const ERROR_CODES_PT: Record<string, string> = {
  DIV_BY_ZERO: "#DIV/0!",
  NAME: "#NOME?",
  VALUE: "#VALOR!",
  REF: "#REF!",
  NUM: "#NÚM!",
  NA: "#N/D",
  CYCLE: "#CICLO!",
  SPILL: "#TRANSPOSIÇÃO!",
  ERROR: "#ERRO!",
};

export function describeError(type: string): { code: string; message: string } {
  return {
    code: ERROR_CODES_PT[type] ?? `#${type}`,
    message: ERROR_MESSAGES[type] ?? "Não foi possível calcular esta fórmula.",
  };
}

/** Functions used in `formula` that HyperFormula (the MVP evaluator) does not support. */
export function unsupportedFunctions(formula: string): string[] {
  if (!formula.trim().startsWith("=")) return [];
  const names = referencedFunctions(normalizeFormula(formula));
  return [...new Set(names.filter((n) => !SUPPORTED_FUNCTIONS.has(n)))];
}

function toRaw(input: CellInput): RawCellContent {
  if (input === null || input === "") return null;
  if (typeof input === "string") return normalizeFormula(input);
  return input;
}

function toEvaluated(raw: unknown): EvaluatedValue {
  if (raw === null || raw === undefined || raw === "") return { kind: "empty" };
  if (raw instanceof DetailedCellError) {
    const unsupported =
      raw.type === "NAME" && /Function name (\S+) not recognized/.exec(raw.message);
    const base = describeError(raw.type);
    return {
      kind: "error",
      code: base.code,
      message: unsupported
        ? `A função ${unsupported[1]} não é suportada nesta versão do treinamento.`
        : base.message,
    };
  }
  if (typeof raw === "number") return { kind: "number", value: raw };
  if (typeof raw === "boolean") return { kind: "boolean", value: raw };
  return { kind: "text", value: String(raw) };
}

export function formatValue(v: EvaluatedValue, locale = "pt-BR"): string {
  switch (v.kind) {
    case "empty":
      return "";
    case "number":
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(v.value);
    case "boolean":
      return v.value ? "VERDADEIRO" : "FALSO";
    case "text":
      return v.value;
    case "error":
      return v.code;
  }
}

/**
 * A single-sheet workbook backed by HyperFormula. Cells are addressed in A1
 * notation; inputs may use pt-BR or English function names.
 */
export class SheetEngine {
  private readonly hf: HyperFormula;
  private readonly sheetId: number;

  constructor(cells: CellMap = {}) {
    this.hf = HyperFormula.buildEmpty({ licenseKey: HYPERFORMULA_LICENSE_KEY });
    const name = this.hf.addSheet(SHEET);
    const id = this.hf.getSheetId(name);
    if (id === undefined) throw new Error("Falha ao criar a planilha.");
    this.sheetId = id;
    this.hf.batch(() => {
      for (const [address, value] of Object.entries(cells)) {
        this.setRaw(address, value);
      }
    });
  }

  private setRaw(address: string, value: CellInput) {
    const { row, col } = parseA1(address);
    this.hf.setCellContents({ sheet: this.sheetId, row, col }, toRaw(value));
  }

  setCell(address: string, value: CellInput): void {
    this.setRaw(address, value);
  }

  getValue(address: string): EvaluatedValue {
    const { row, col } = parseA1(address);
    return toEvaluated(this.hf.getCellValue({ sheet: this.sheetId, row, col }));
  }

  /**
   * Evaluate `input` as if it were typed into `address`, without keeping the change.
   * Used for live preview while the student types in the formula bar.
   */
  preview(address: string, input: string): EvaluatedValue {
    if (input.trim() === "") return { kind: "empty" };
    const normalized = normalizeFormula(input);
    if (normalized.startsWith("=") && !this.hf.validateFormula(normalized)) {
      return { kind: "error", ...describeError("ERROR") };
    }
    const { row, col } = parseA1(address);
    const cell = { sheet: this.sheetId, row, col };
    const previous = this.hf.getCellSerialized(cell);
    this.hf.suspendEvaluation();
    this.hf.setCellContents(cell, normalized);
    this.hf.resumeEvaluation();
    const result = toEvaluated(this.hf.getCellValue(cell));
    this.hf.suspendEvaluation();
    this.hf.setCellContents(cell, previous as RawCellContent);
    this.hf.resumeEvaluation();
    return result;
  }

  /** Evaluated values for every non-empty cell, keyed by A1 address. */
  snapshot(): Record<string, EvaluatedValue> {
    const out: Record<string, EvaluatedValue> = {};
    const values = this.hf.getSheetValues(this.sheetId);
    values.forEach((row, r) =>
      row.forEach((raw, c) => {
        const v = toEvaluated(raw);
        if (v.kind !== "empty") out[toA1({ row: r, col: c })] = v;
      }),
    );
    return out;
  }

  destroy(): void {
    this.hf.destroy();
  }
}
