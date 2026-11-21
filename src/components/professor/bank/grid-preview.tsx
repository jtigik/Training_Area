import { columnLabel, formatCellInput, toAddress } from "@/lib/domain/grid";
import type { AnswerCell, CellAddress, SpreadsheetGrid } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Grade somente leitura (até 8×6) para conferir uma importação. Gabarito destacado. */
export function GridPreview({
  grid,
  answers,
  label,
}: {
  grid: SpreadsheetGrid;
  answers: Record<CellAddress, AnswerCell>;
  label: string;
}) {
  const rows = Math.min(grid.rows, 8);
  const cols = Math.min(grid.cols, 6);
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="bg-grid-header border-grid-line w-8 border" aria-hidden="true" />
            {Array.from({ length: cols }, (_, c) => (
              <th
                key={c}
                scope="col"
                className="bg-grid-header border-grid-line w-20 border font-medium"
              >
                {columnLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th scope="row" className="bg-grid-header border-grid-line border px-1 font-medium">
                {r + 1}
              </th>
              {Array.from({ length: cols }, (_, c) => {
                const a = toAddress(r, c);
                const answer = answers[a];
                return (
                  <td
                    key={a}
                    className={cn(
                      "border-grid-line h-6 border px-1",
                      grid.cells[a]?.locked && "bg-grid-locked",
                      answer && "bg-grid-target border-grid-target-border font-mono",
                    )}
                  >
                    {formatCellInput(answer ? answer.expected : grid.cells[a]?.value)}
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
