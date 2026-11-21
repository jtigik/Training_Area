import type { ConfigParams } from "hyperformula";
import type { GradingLimits } from "./types";

/**
 * HyperFormula is dual-licensed (GPL-3.0 or commercial). 'gpl-v3' is used for now;
 * see README.md in this folder before shipping (repo is MIT).
 */
export const HYPERFORMULA_LICENSE_KEY = "gpl-v3";

export const DEFAULT_SHEET_NAME = "Planilha1";

export const DEFAULT_LIMITS: GradingLimits = {
  maxFormulaLength: 2000,
  maxNestingDepth: 64, // Excel's own nesting limit
  maxRows: 1000,
  maxColumns: 100,
  maxCells: 10_000,
  maxCellTextLength: 10_000,
  maxResultStringLength: 32_767, // Excel's max characters per cell
};

export function resolveLimits(overrides?: Partial<GradingLimits>): GradingLimits {
  return { ...DEFAULT_LIMITS, ...overrides };
}

export function hyperFormulaConfig(limits: GradingLimits): Partial<ConfigParams> {
  return {
    licenseKey: HYPERFORMULA_LICENSE_KEY,
    maxRows: limits.maxRows,
    maxColumns: limits.maxColumns,
    // Evaluation dialect is always English names + ',' arguments + '.' decimals;
    // pt-BR input is translated beforehand by tokenizer.normalizeFormula.
    functionArgSeparator: ",",
    decimalSeparator: ".",
    thousandSeparator: "",
    localeLang: "pt-BR",
    caseSensitive: false,
    dateFormats: ["DD/MM/YYYY", "DD/MM/YY", "YYYY-MM-DD"],
    timeFormats: ["hh:mm", "hh:mm:ss.sss"],
    currencySymbol: ["R$", "$"],
    nullDate: { year: 1899, month: 12, day: 30 },
    useArrayArithmetic: false,
    useColumnIndex: false,
  };
}
