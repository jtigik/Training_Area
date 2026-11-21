"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { columnLabel, parseA1, toA1 } from "@/lib/formula/a1";
import { cn } from "@/lib/utils";

export interface SpreadsheetGridProps {
  rows: number;
  cols: number;
  /** Display text per A1 address. */
  display: Record<string, string>;
  /** Addresses whose value is numeric (right-aligned, like Excel). */
  numeric?: ReadonlySet<string>;
  /** Addresses whose value is an error. */
  errors?: ReadonlySet<string>;
  /** Cells the student may edit; every other cell is read-only. */
  editable: ReadonlySet<string>;
  /** Answer cell (highlighted). */
  target?: string;
  selected: string;
  /** Cells referenced by the formula being typed. */
  highlighted?: ReadonlySet<string>;
  onSelect: (ref: string) => void;
  /** Enter/F2/double-click, or typing a character (passed as `initialText`) on an editable cell. */
  onEdit: (ref: string, initialText?: string) => void;
  label?: string;
  describedBy?: string;
  targetDescriptionId?: string;
}

/**
 * Spreadsheet-like grid (WAI-ARIA grid pattern) with A1 addressing:
 * roving tabindex, arrow/Home/End/Ctrl+Home/PageUp/PageDown navigation,
 * Enter/F2 to edit, Tab leaves the grid.
 */
export function SpreadsheetGrid({
  rows,
  cols,
  display,
  numeric,
  errors,
  editable,
  target,
  selected,
  highlighted,
  onSelect,
  onEdit,
  label = "Planilha do exercício",
  describedBy,
  targetDescriptionId,
}: SpreadsheetGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const focusOnSelect = useRef(false);

  useEffect(() => {
    if (!focusOnSelect.current) return;
    focusOnSelect.current = false;
    tableRef.current?.querySelector<HTMLElement>(`[data-ref="${selected}"]`)?.focus();
  }, [selected]);

  function move(ref: string) {
    focusOnSelect.current = true;
    onSelect(ref);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableCellElement>, ref: string) {
    const { row, col } = parseA1(ref);
    const go = (r: number, c: number) => {
      e.preventDefault();
      move(
        toA1({ row: Math.max(0, Math.min(rows - 1, r)), col: Math.max(0, Math.min(cols - 1, c)) }),
      );
    };
    switch (e.key) {
      case "ArrowUp":
        return go(row - 1, col);
      case "ArrowDown":
        return go(row + 1, col);
      case "ArrowLeft":
        return go(row, col - 1);
      case "ArrowRight":
        return go(row, col + 1);
      case "Home":
        return e.ctrlKey || e.metaKey ? go(0, 0) : go(row, 0);
      case "End":
        return e.ctrlKey || e.metaKey ? go(rows - 1, cols - 1) : go(row, cols - 1);
      case "PageUp":
        return go(row - 10, col);
      case "PageDown":
        return go(row + 10, col);
      case "Enter":
      case "F2":
        e.preventDefault();
        return onEdit(ref);
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && editable.has(ref)) {
          e.preventDefault();
          onEdit(ref, e.key);
        }
    }
  }

  return (
    <div className="max-h-[60vh] overflow-auto rounded-md border border-grid-line">
      <table
        ref={tableRef}
        role="grid"
        aria-label={label}
        aria-rowcount={rows + 1}
        aria-colcount={cols + 1}
        aria-describedby={describedBy}
        className="border-collapse font-formula text-sm"
      >
        <thead>
          <tr role="row" aria-rowindex={1}>
            <th
              role="columnheader"
              aria-label="Linhas e colunas"
              className="sticky top-0 left-0 z-20 w-grid-rowhead border border-grid-line bg-grid-header"
            />
            {Array.from({ length: cols }, (_, c) => (
              <th
                key={c}
                scope="col"
                role="columnheader"
                aria-colindex={c + 2}
                className="sticky top-0 z-10 h-grid-row min-w-grid-col border border-grid-line bg-grid-header px-2 text-xs font-semibold text-grid-header-foreground"
              >
                {columnLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} role="row" aria-rowindex={r + 2}>
              <th
                scope="row"
                role="rowheader"
                className="sticky left-0 z-10 w-grid-rowhead border border-grid-line bg-grid-header px-2 text-center text-xs font-semibold text-grid-header-foreground"
              >
                {r + 1}
              </th>
              {Array.from({ length: cols }, (_, c) => {
                const ref = toA1({ row: r, col: c });
                const isSelected = ref === selected;
                const isEditable = editable.has(ref);
                const isTarget = ref === target;
                return (
                  <td
                    key={ref}
                    role="gridcell"
                    data-ref={ref}
                    data-testid={`cell-${ref}`}
                    aria-colindex={c + 2}
                    aria-selected={isSelected}
                    aria-readonly={isEditable ? undefined : true}
                    aria-describedby={isTarget ? targetDescriptionId : undefined}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelect(ref)}
                    onDoubleClick={() => onEdit(ref)}
                    onKeyDown={(e) => onKeyDown(e, ref)}
                    className={cn(
                      "h-grid-row max-w-60 min-w-grid-col cursor-cell truncate border border-grid-line px-2 whitespace-nowrap outline-none",
                      isEditable
                        ? "bg-grid-cell text-grid-cell-foreground"
                        : "bg-grid-locked text-grid-locked-foreground",
                      highlighted?.has(ref) && "bg-grid-range",
                      isTarget &&
                        "bg-grid-target font-semibold text-grid-cell-foreground outline-2 -outline-offset-2 outline-grid-target-border outline-dashed",
                      numeric?.has(ref) && "text-right",
                      errors?.has(ref) && "text-error",
                      isSelected &&
                        "outline-2 -outline-offset-2 outline-grid-selected outline-solid",
                    )}
                  >
                    {display[ref] ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
