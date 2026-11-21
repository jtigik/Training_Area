import {
  formatValue,
  SheetEngine,
  unsupportedFunctions,
  type CellMap,
  type EvaluatedValue,
} from "./engine";

export interface SheetEvaluation {
  /** Display text per A1 address (only non-empty cells). */
  display: Record<string, string>;
  /** Raw evaluated values per address. */
  values: Record<string, EvaluatedValue>;
  /** Value of the cell that was overridden (if any). */
  target: EvaluatedValue;
}

/**
 * Evaluate `cells` with `target` set to `input`, in an isolated HyperFormula
 * instance (created and destroyed here, so it is safe to call from render/memo).
 */
export function evaluateSheet(cells: CellMap, target: string, input: string): SheetEvaluation {
  const engine = new SheetEngine(cells);
  try {
    let targetValue = engine.preview(target, input);
    if (targetValue.kind === "error") {
      // A parse error caused by an unsupported function (e.g. LAMBDA(...)(A1)) is more
      // useful to the student as "function not supported" than as a generic syntax error.
      const missing = unsupportedFunctions(input);
      if (missing.length > 0) {
        targetValue = {
          ...targetValue,
          message: `A função ${missing[0]} não é suportada nesta versão do treinamento.`,
        };
      }
    }
    if (input.trim() !== "" && targetValue.kind !== "error") engine.setCell(target, input);
    const values = engine.snapshot();
    if (targetValue.kind === "error") values[target] = targetValue;
    const display: Record<string, string> = {};
    for (const [ref, v] of Object.entries(values)) display[ref] = formatValue(v);
    return { display, values, target: targetValue };
  } finally {
    engine.destroy();
  }
}
