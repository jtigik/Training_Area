"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { validateAnswers, createEmptyGrid, normalizeGrid } from "@/lib/domain/grid";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "@/lib/domain/labels";
import {
  DIFFICULTIES,
  MVP_LEVELS,
  type ExerciseContent,
  type ExerciseSetStatus,
  type Level,
} from "@/lib/domain/types";
import { bankMetaSchema, type BankMetaValues } from "@/lib/validation/schemas";
import { errorMessage } from "@/lib/errors";
import { GridEditor, type GridEditorValue } from "./grid-editor";
import { openPreview } from "./exercise-preview";

export interface ExerciseFormSubmit extends ExerciseContent {
  status: ExerciseSetStatus;
  tags: string[];
}

interface ExerciseFormProps {
  initial?: Partial<ExerciseContent> & { tags?: string[] };
  /** Níveis do conjunto; o nível do exercício precisa estar entre eles. */
  allowedLevels?: Level[];
  /** Mostra o campo de tags (banco de exercícios). */
  withTags?: boolean;
  onSubmit: (values: ExerciseFormSubmit) => Promise<void>;
  /** Mensagem de sucesso exibida após salvar (controlada pela página). */
  footer?: React.ReactNode;
}

/** Formulário do exercício: metadados + grade/gabarito. Serve para conjuntos e para o banco. */
export function ExerciseForm({
  initial,
  allowedLevels,
  withTags,
  onSubmit,
  footer,
}: ExerciseFormProps) {
  const [gridValue, setGridValue] = useState<GridEditorValue>({
    grid: initial?.grid ?? createEmptyGrid(),
    answers: initial?.answers ?? {},
  });
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<BankMetaValues>({
    resolver: zodResolver(bankMetaSchema),
    defaultValues: {
      title: initial?.title ?? "",
      statement: initial?.statement ?? "",
      level: (initial?.level ?? allowedLevels?.[0] ?? "FUNDAMENTAL") as BankMetaValues["level"],
      difficulty: initial?.difficulty as BankMetaValues["difficulty"],
      hint: initial?.hint ?? "",
      tags: initial?.tags?.join(", ") ?? "",
    },
  });
  const { register, handleSubmit, formState } = form;
  const level = useWatch({ control: form.control, name: "level" });

  const gridIssues = validateAnswers(gridValue.grid, gridValue.answers);
  const levelIssue =
    allowedLevels && level && !allowedLevels.includes(level)
      ? `O nível ${LEVEL_LABELS[level]} não faz parte deste conjunto (${allowedLevels.map((l) => LEVEL_LABELS[l]).join(", ")}).`
      : null;
  const extra = attempted
    ? [...(levelIssue ? [levelIssue] : []), ...gridIssues.map((i) => i.message)]
    : [];
  const messages = [
    ...collectErrorMessages(formState.errors),
    ...extra,
    ...(serverError ? [serverError] : []),
  ];

  const submitWith = (status: ExerciseSetStatus) => {
    setAttempted(true);
    setServerError(null);
    return handleSubmit(async (meta) => {
      if (levelIssue || gridIssues.length > 0) return;
      setSaving(true);
      try {
        await onSubmit({
          title: meta.title,
          statement: meta.statement,
          level: meta.level,
          difficulty: meta.difficulty,
          hint: meta.hint.trim() ? meta.hint.trim() : null,
          grid: normalizeGrid(gridValue.grid),
          answers: gridValue.answers,
          status,
          tags: meta.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        });
      } catch (e) {
        setServerError(errorMessage(e));
      } finally {
        setSaving(false);
      }
    })();
  };

  const preview = () => {
    const v = form.getValues();
    openPreview({
      title: v.title || "Exercício sem título",
      statement: v.statement,
      level: v.level,
      difficulty: v.difficulty ?? "MEDIUM",
      hint: v.hint || null,
      grid: normalizeGrid(gridValue.grid),
      answers: gridValue.answers,
    });
  };

  return (
    <form noValidate className="grid gap-6" onSubmit={(e) => e.preventDefault()}>
      <FormErrorSummary messages={messages} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Título"
          required
          error={formState.errors.title?.message}
          className="md:col-span-2"
        >
          <Input {...register("title")} />
        </Field>
        <Field
          label="Nível"
          required
          error={
            formState.errors.level?.message ?? (attempted ? (levelIssue ?? undefined) : undefined)
          }
        >
          <NativeSelect {...register("level")}>
            {MVP_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <fieldset
          className="grid gap-1.5"
          aria-describedby={formState.errors.difficulty ? "difficulty-error" : undefined}
        >
          <legend className="mb-1.5 text-sm font-medium">
            Dificuldade
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  value={d}
                  className="accent-primary size-4"
                  {...register("difficulty")}
                />
                {DIFFICULTY_LABELS[d]}
              </label>
            ))}
          </div>
          {formState.errors.difficulty ? (
            <p id="difficulty-error" className="text-destructive text-sm">
              {formState.errors.difficulty.message}
            </p>
          ) : null}
        </fieldset>
        <Field
          label="Enunciado"
          required
          error={formState.errors.statement?.message}
          className="md:col-span-2"
        >
          <Textarea rows={3} {...register("statement")} />
        </Field>
        <Field label="Dica (opcional)" error={formState.errors.hint?.message}>
          <Input {...register("hint")} />
        </Field>
        {withTags ? (
          <Field label="Tags (separadas por vírgula)" error={formState.errors.tags?.message}>
            <Input {...register("tags")} />
          </Field>
        ) : null}
      </div>

      <GridEditor
        grid={gridValue.grid}
        answers={gridValue.answers}
        onChange={setGridValue}
        invalid={attempted ? gridIssues.map((i) => i.address).filter(Boolean) : []}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={preview}>
          Pré-visualizar como aluno
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => submitWith("DRAFT")}
        >
          Salvar rascunho
        </Button>
        <Button type="button" disabled={saving} onClick={() => submitWith("PUBLISHED")}>
          Salvar e publicar
        </Button>
      </div>
      {footer}
    </form>
  );
}
