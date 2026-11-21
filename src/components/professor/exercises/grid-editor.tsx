"use client";

import { useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxField } from "@/components/common/checkbox-field";
import {
  columnLabel,
  formatCellInput,
  inferAnswer,
  MAX_COLS,
  MAX_ROWS,
  moveFocus,
  parseAddress,
  parseCellInput,
  toAddress,
  type Direction,
} from "@/lib/domain/grid";
import { displayValue } from "@/lib/domain/formula";
import type { AnswerCell, CellAddress, CellValue, SpreadsheetGrid } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { EditableCell } from "./editable-cell";

const normalizeText = (text: string) => formatCellInput(parseCellInput(text));

function cellTypeLabel(value: CellValue): string {
  if (value === null) return "vazia";
  if (typeof value === "object") return "fórmula";
  if (typeof value === "number") return "número";
  if (typeof value === "boolean") return "lógico";
  return "texto";
}

/**
 * Input com rascunho local: enquanto o professor digita, o texto fica como está
 * (ex.: "'" ou "1,"); fora do foco mostra o valor tipado formatado.
 */
function TypedInput({
  cellValue,
  onText,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
  cellValue: CellValue | undefined;
  onText: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...props}
      value={draft ?? formatCellInput(cellValue)}
      onChange={(e) => {
        setDraft(e.target.value);
        onText(e.target.value);
      }}
      onBlur={(e) => {
        setDraft(null);
        props.onBlur?.(e);
      }}
    />
  );
}

export interface GridEditorValue {
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
}

interface GridEditorProps extends GridEditorValue {
  onChange: (value: GridEditorValue) => void;
  /** Endereços com problema (destacados). */
  invalid?: CellAddress[];
}

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Editor da grade do exercício: "Planilha inicial" (o que o aluno recebe, com células
 * bloqueadas) e "Gabarito" (resultado esperado por célula: valor ou fórmula).
 */
export function GridEditor({ grid, answers, onChange, invalid = [] }: GridEditorProps) {
  const id = useId();
  const [selected, setSelected] = useState<CellAddress>("A1");
  const containerRef = useRef<HTMLDivElement>(null);
  const lookup = (a: string) => grid.cells[a]?.value;

  const setCell = (address: CellAddress, text: string) => {
    const cells = { ...grid.cells };
    const value = parseCellInput(text);
    if (value === null) delete cells[address];
    else cells[address] = { value, locked: cells[address]?.locked ?? true };
    onChange({ grid: { ...grid, cells }, answers });
  };
  const setLocked = (address: CellAddress, locked: boolean) => {
    const current = grid.cells[address];
    if (!current) return;
    onChange({
      grid: { ...grid, cells: { ...grid.cells, [address]: { ...current, locked } } },
      answers,
    });
  };
  const setAnswer = (address: CellAddress, text: string) => {
    const next = { ...answers };
    const answer = inferAnswer(text, answers[address]);
    if (answer) next[address] = answer;
    else delete next[address];
    // Célula de gabarito precisa ficar livre para o aluno.
    const cells = { ...grid.cells };
    if (answer && cells[address]?.locked) cells[address] = { ...cells[address], locked: false };
    onChange({ grid: { ...grid, cells }, answers: next });
  };
  const setTolerance = (address: CellAddress, tolerance: number) => {
    const current = answers[address];
    if (!current) return;
    onChange({ grid, answers: { ...answers, [address]: { ...current, tolerance } } });
  };
  const resize = (rows: number, cols: number) => {
    const r = Math.max(1, Math.min(MAX_ROWS, rows || 1));
    const c = Math.max(1, Math.min(MAX_COLS, cols || 1));
    onChange({ grid: { ...grid, rows: r, cols: c }, answers });
  };

  const focusCell = (prefix: "cell" | "answer-cell", address: CellAddress) => {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-testid="${prefix}-${address}"]`)
      ?.focus();
  };
  const navigate = (prefix: "cell" | "answer-cell", address: CellAddress, key: string) => {
    const dir = DIRECTIONS[key];
    if (!dir) return;
    const pos = parseAddress(address);
    if (!pos) return;
    const moved = moveFocus(pos.row, pos.col, dir, grid);
    const next = toAddress(moved.row, moved.col);
    setSelected(next);
    focusCell(prefix, next);
  };

  const selectedCell = grid.cells[selected];
  const selectedAnswer = answers[selected];
  const pos = parseAddress(selected);
  const inside = pos ? pos.row < grid.rows && pos.col < grid.cols : false;

  const header = (
    <thead>
      <tr>
        <th
          scope="col"
          className="bg-grid-header w-grid-rowhead border-grid-line border"
          aria-hidden="true"
        />
        {Array.from({ length: grid.cols }, (_, c) => (
          <th
            key={c}
            scope="col"
            className="bg-grid-header border-grid-line min-w-grid-col border text-xs font-medium"
          >
            {columnLabel(c)}
          </th>
        ))}
      </tr>
    </thead>
  );

  return (
    <div ref={containerRef} className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-rows`}>Linhas</Label>
          <Input
            id={`${id}-rows`}
            type="number"
            min={1}
            max={MAX_ROWS}
            className="w-24"
            value={grid.rows}
            onChange={(e) => resize(e.target.valueAsNumber, grid.cols)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-cols`}>Colunas</Label>
          <Input
            id={`${id}-cols`}
            type="number"
            min={1}
            max={MAX_COLS}
            className="w-24"
            value={grid.cols}
            onChange={(e) => resize(grid.rows, e.target.valueAsNumber)}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Use as setas ou Enter para navegar. Até {MAX_ROWS} linhas e {MAX_COLS} colunas. Números,
          TRUE/FALSE e fórmulas (=) são reconhecidos; comece com apóstrofo (&apos;10) para guardar
          como texto.
        </p>
      </div>

      <section aria-labelledby={`${id}-initial`} className="grid gap-2">
        <h3 id={`${id}-initial`} className="text-sm font-semibold">
          Planilha inicial{" "}
          <span className="text-muted-foreground font-normal">— dados que o aluno recebe</span>
        </h3>
        <div className="overflow-x-auto rounded-md border">
          <table role="grid" aria-label="Planilha inicial" className="border-collapse">
            {header}
            <tbody>
              {Array.from({ length: grid.rows }, (_, r) => (
                <tr key={r}>
                  <th
                    scope="row"
                    className="bg-grid-header border-grid-line border px-2 text-xs font-medium"
                  >
                    {r + 1}
                  </th>
                  {Array.from({ length: grid.cols }, (_, c) => {
                    const address = toAddress(r, c);
                    const cell = grid.cells[address];
                    return (
                      <td
                        key={address}
                        className={cn(
                          "border-grid-line h-grid-row w-grid-col border p-0",
                          cell?.locked ? "bg-grid-locked" : "bg-grid-cell",
                          answers[address] && "bg-grid-target",
                          selected === address && "outline-primary outline-2 -outline-offset-2",
                        )}
                      >
                        <EditableCell
                          data-testid={`cell-${address}`}
                          aria-label={`Célula ${address}${cell?.locked ? " (bloqueada para o aluno)" : ""}`}
                          value={formatCellInput(cell?.value)}
                          format={normalizeText}
                          onValueChange={(v) => setCell(address, v)}
                          onFocus={() => setSelected(address)}
                          onNavigate={(key) => navigate("cell", address, key)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby={`${id}-answers`} className="grid gap-2">
        <h3 id={`${id}-answers`} className="text-sm font-semibold">
          Gabarito{" "}
          <span className="text-muted-foreground font-normal">
            — resultado esperado (valor ou fórmula começando com =)
          </span>
        </h3>
        <div className="overflow-x-auto rounded-md border">
          <table role="grid" aria-label="Gabarito" className="border-collapse">
            {header}
            <tbody>
              {Array.from({ length: grid.rows }, (_, r) => (
                <tr key={r}>
                  <th
                    scope="row"
                    className="bg-grid-header border-grid-line border px-2 text-xs font-medium"
                  >
                    {r + 1}
                  </th>
                  {Array.from({ length: grid.cols }, (_, c) => {
                    const address = toAddress(r, c);
                    const answer = answers[address];
                    return (
                      <td
                        key={address}
                        className={cn(
                          "border-grid-line h-grid-row w-grid-col border p-0",
                          answer ? "bg-grid-target" : "bg-grid-cell",
                          invalid.includes(address) &&
                            "outline-destructive outline-2 -outline-offset-2",
                        )}
                      >
                        <TypedInput
                          data-testid={`answer-cell-${address}`}
                          aria-label={`Gabarito ${address}`}
                          aria-invalid={invalid.includes(address) || undefined}
                          className="h-full w-full bg-transparent px-1.5 text-sm outline-none focus:ring-2 focus:ring-inset"
                          cellValue={answer?.expected}
                          onText={(text) => setAnswer(address, text)}
                          onFocus={() => setSelected(address)}
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
                              e.preventDefault();
                              navigate(
                                "answer-cell",
                                address,
                                e.key === "Enter" ? "ArrowDown" : e.key,
                              );
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div
        aria-label={`Opções da célula ${selected}`}
        role="group"
        className="bg-muted/40 flex flex-wrap items-center gap-4 rounded-md p-3 text-sm"
      >
        <span className="font-medium">Célula {selected}</span>
        {inside && selectedCell ? (
          <>
            <span className="text-muted-foreground">
              Mostra: {displayValue(selectedCell.value, lookup) || "—"} ·{" "}
              {cellTypeLabel(selectedCell.value)}
            </span>
            <CheckboxField
              label="Bloqueada para o aluno"
              checked={selectedCell.locked}
              onChange={(e) => setLocked(selected, e.target.checked)}
            />
          </>
        ) : (
          <span className="text-muted-foreground">Sem dado inicial.</span>
        )}
        {selectedAnswer ? (
          <>
            <span>Gabarito: {selectedAnswer.kind === "FORMULA" ? "fórmula" : "valor"}</span>
            {selectedAnswer.kind === "VALUE" ? (
              <span className="inline-flex items-center gap-2">
                <Label htmlFor={`${id}-tol`}>Tolerância</Label>
                <Input
                  id={`${id}-tol`}
                  type="number"
                  min={0}
                  step="any"
                  className="h-8 w-24"
                  value={selectedAnswer.tolerance ?? 0}
                  onChange={(e) => setTolerance(selected, e.target.valueAsNumber || 0)}
                />
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
