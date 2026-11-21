"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LevelBadge, DifficultyBadge } from "@/components/common/badges";
import { columnLabel, toAddress } from "@/lib/domain/grid";
import { displayValue, sameValue } from "@/lib/domain/formula";
import type { ExerciseContent } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Pré-visualização "como aluno": mesma interação da prática (selecionar célula,
 * digitar fórmula, enviar), sem mostrar o gabarito e sem gravar tentativa.
 * A conferência aqui é local e aproximada; a correção oficial é do backend.
 */
export function ExercisePreview({ exercise }: { exercise: ExerciseContent }) {
  const id = useId();
  const answerCells = Object.keys(exercise.answers);
  const [selected, setSelected] = useState(answerCells[0] ?? "A1");
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const lookup = (a: string) => entries[a] ?? exercise.grid.cells[a]?.value;
  const locked = (a: string) => exercise.grid.cells[a]?.locked ?? false;

  function select(address: string) {
    setSelected(address);
    setDraft(
      entries[address] ?? (locked(address) ? "" : (exercise.grid.cells[address]?.value ?? "")),
    );
  }

  function submit() {
    const next = { ...entries, [selected]: draft };
    setEntries(next);
    const look = (a: string) => next[a] ?? exercise.grid.cells[a]?.value;
    const wrong = answerCells.filter(
      (a) =>
        !next[a] ||
        !sameValue(next[a], exercise.answers[a].expected, look, exercise.answers[a].tolerance ?? 0),
    );
    setResult(
      wrong.length === 0
        ? { ok: true, detail: "Todas as células esperadas estão certas." }
        : {
            ok: false,
            detail: `Confira ${wrong.length === 1 ? "a célula" : "as células"} ${wrong.join(", ")}.`,
          },
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <LevelBadge level={exercise.level} />
        <DifficultyBadge difficulty={exercise.difficulty} />
      </div>
      <h1 className="text-xl font-semibold">{exercise.title}</h1>
      <p className="whitespace-pre-wrap">{exercise.statement}</p>
      {exercise.hint ? (
        <p className="text-muted-foreground text-sm">Dica: {exercise.hint}</p>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid min-w-64 flex-1 gap-1.5">
          <Label htmlFor={`${id}-formula`}>Fórmula ou valor da célula {selected}</Label>
          <Input
            id={`${id}-formula`}
            value={draft}
            disabled={locked(selected)}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="=SOMA(A1:A3)"
          />
        </div>
        <Button type="submit" disabled={locked(selected)}>
          Enviar resposta
        </Button>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <table role="grid" aria-label="Planilha do exercício" className="border-collapse">
          <thead>
            <tr>
              <th
                className="bg-grid-header w-grid-rowhead border-grid-line border"
                aria-hidden="true"
              />
              {Array.from({ length: exercise.grid.cols }, (_, c) => (
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
          <tbody>
            {Array.from({ length: exercise.grid.rows }, (_, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className="bg-grid-header border-grid-line border px-2 text-xs font-medium"
                >
                  {r + 1}
                </th>
                {Array.from({ length: exercise.grid.cols }, (_, c) => {
                  const a = toAddress(r, c);
                  const raw = lookup(a) ?? "";
                  return (
                    <td
                      key={a}
                      role="gridcell"
                      aria-selected={selected === a}
                      data-testid={`cell-${a}`}
                      tabIndex={selected === a ? 0 : -1}
                      onClick={() => select(a)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(a);
                        }
                      }}
                      className={cn(
                        "border-grid-line h-grid-row w-grid-col cursor-cell border px-1.5 text-sm",
                        locked(a) ? "bg-grid-locked" : "bg-grid-cell",
                        exercise.answers[a] && "bg-grid-target",
                        selected === a &&
                          "bg-grid-selected outline-primary outline-2 -outline-offset-2",
                      )}
                    >
                      {displayValue(raw, lookup)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div role="status" aria-live="polite" className="min-h-6">
        {result ? (
          <div
            className={cn(
              "rounded-md border p-3",
              result.ok ? "border-success bg-success-subtle" : "border-error bg-error-subtle",
            )}
          >
            <h2 className="font-semibold">{result.ok ? "Correto" : "Incorreto"}</h2>
            <p className="text-sm">{result.detail}</p>
          </div>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Pré-visualização: nada é gravado como tentativa.
      </p>
    </div>
  );
}

export const PREVIEW_STORAGE_KEY = "training-area:preview";

/** Abre a pré-visualização em nova aba (o conteúdo vai pelo localStorage). */
export function openPreview(exercise: ExerciseContent) {
  window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(exercise));
  window.open("/professor/pre-visualizacao", "_blank");
}
