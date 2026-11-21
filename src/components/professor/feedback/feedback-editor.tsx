"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { PageHeader } from "@/components/common/page-header";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { ErrorState, LoadingState, StatusMessage } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useResource } from "@/hooks/use-resource";
import { renderTemplate, TEMPLATE_VARIABLES, validateBands } from "@/lib/domain/rules";
import type { FeedbackTemplate } from "@/lib/domain/types";
import { errorMessage } from "@/lib/errors";
import { getServices } from "@/lib/services";
import { feedbackFormSchema, type FeedbackFormValues } from "@/lib/validation/schemas";

/** /professor/feedback — faixas de feedback (TA-027), padrão da instituição ou por conjunto. */
export function FeedbackPage() {
  const [setId, setSetId] = useState<string>("");
  const sets = useResource(() => getServices().sets.list(), "sets");
  const template = useResource(
    () => getServices().feedback.get(setId || null),
    `feedback:${setId}`,
  );
  return (
    <>
      <PageHeader
        title="Faixas de feedback"
        description="Texto automático por faixa de acerto ao concluir um nível. O feedback gerado por IA passa pela revisão antes de chegar ao aluno."
      />
      <div className="mb-4 max-w-sm">
        <Field
          label="Aplicar a"
          description="Sem modelo próprio, o conjunto usa o padrão da instituição."
        >
          <NativeSelect value={setId} onChange={(e) => setSetId(e.target.value)}>
            <option value="">Padrão da instituição</option>
            {(sets.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                Conjunto {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {template.error ? (
        <ErrorState error={template.error} onRetry={template.reload} />
      ) : !template.data ? (
        <LoadingState />
      ) : (
        <FeedbackEditor
          key={`${setId}:${template.data.updatedAt}`}
          template={template.data}
          setId={setId || null}
        />
      )}
    </>
  );
}

export function FeedbackEditor({
  template,
  setId,
}: {
  template: FeedbackTemplate;
  setId: string | null;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [rangeErrors, setRangeErrors] = useState<string[]>([]);
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      bands: template.bands.map(({ minPercent, maxPercent, label, template: t }) => ({
        minPercent,
        maxPercent,
        label,
        template: t,
      })),
    },
  });
  const { register, handleSubmit, formState, control } = form;
  const bands = useFieldArray({ control, name: "bands" });
  const values = useWatch({ control, name: "bands" });

  const submit = handleSubmit(async (v) => {
    const issues = validateBands(v.bands);
    setRangeErrors(issues);
    if (issues.length) return;
    try {
      await getServices().feedback.save({ setId, bands: v.bands });
      form.reset(v);
      setMessage({ kind: "ok", text: "Faixas salvas." });
    } catch (e) {
      setMessage({ kind: "erro", text: errorMessage(e) });
    }
  });

  const messages = [...collectErrorMessages(formState.errors), ...rangeErrors];

  return (
    <form noValidate onSubmit={submit} className="grid gap-4">
      <FormErrorSummary messages={messages} />
      <p className="text-muted-foreground text-xs">
        Variáveis: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}. As faixas precisam cobrir
        de 0% a 100% sem lacunas.
      </p>
      <ol className="grid gap-3">
        {bands.fields.map((f, i) => {
          const sample = values[i];
          const pct = sample
            ? Math.round(((Number(sample.minPercent) || 0) + (Number(sample.maxPercent) || 0)) / 2)
            : 0;
          return (
            <li
              key={f.id}
              data-testid={`feedback-band-${i}`}
              className="bg-card grid gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-end gap-3">
                <Field label="De (%)" error={formState.errors.bands?.[i]?.minPercent?.message}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    {...register(`bands.${i}.minPercent`, { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Até (%)" error={formState.errors.bands?.[i]?.maxPercent?.message}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    {...register(`bands.${i}.maxPercent`, { valueAsNumber: true })}
                  />
                </Field>
                <Field
                  label="Rótulo (opcional)"
                  className="min-w-40 flex-1"
                  error={formState.errors.bands?.[i]?.label?.message}
                >
                  <Input {...register(`bands.${i}.label`)} />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover faixa ${i + 1}`}
                  disabled={bands.fields.length === 1}
                  onClick={() => bands.remove(i)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <Field label="Texto" error={formState.errors.bands?.[i]?.template?.message}>
                <Textarea rows={2} {...register(`bands.${i}.template`)} />
              </Field>
              {sample?.template ? (
                <p className="text-muted-foreground text-xs">
                  Exemplo ({pct}%):{" "}
                  {renderTemplate(sample.template, {
                    nome: "Ana",
                    nivel: "Fundamental",
                    acertos: pct,
                    total: 100,
                  })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => bands.append({ minPercent: 0, maxPercent: 100, label: "", template: "" })}
        >
          <Plus aria-hidden="true" /> Adicionar faixa
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          Salvar
        </Button>
      </div>
      <StatusMessage message={message} />
    </form>
  );
}
