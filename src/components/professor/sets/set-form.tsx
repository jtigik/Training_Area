"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/common/field";
import { NativeSelect } from "@/components/common/native-select";
import { collectErrorMessages, FormErrorSummary } from "@/components/common/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "@/lib/domain/labels";
import {
  DIFFICULTIES,
  MVP_LEVELS,
  type Classroom,
  type ExerciseSet,
  type MvpLevel,
} from "@/lib/domain/types";
import type { ExerciseSetInput, StudentSummary } from "@/lib/services";
import { errorMessage } from "@/lib/errors";
import { exerciseSetFormSchema, type ExerciseSetFormValues } from "@/lib/validation/schemas";

interface SetFormProps {
  set?: ExerciseSet;
  students: StudentSummary[];
  classrooms: Classroom[];
  onSubmit: (input: ExerciseSetInput) => Promise<void>;
}

const isMvp = (l: string): l is MvpLevel => (MVP_LEVELS as readonly string[]).includes(l);

/** Formulário do conjunto: níveis, dificuldades, quantidade por aluno e exceções. */
export function SetForm({ set, students, classrooms, onSubmit }: SetFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ExerciseSetFormValues>({
    resolver: zodResolver(exerciseSetFormSchema),
    defaultValues: {
      name: set?.name ?? "",
      description: set?.description ?? "",
      levels: (set?.levels ?? []).filter(isMvp),
      difficulties: set?.difficulties ?? [],
      quantities: (set?.quantities ?? []).filter((q) =>
        isMvp(q.level),
      ) as ExerciseSetFormValues["quantities"],
      overrides: (set?.overrides ?? [])
        .filter((o) => isMvp(o.level))
        .map(({ targetType, targetId, level, quantity }) => ({
          targetType,
          targetId,
          level,
          quantity,
        })) as ExerciseSetFormValues["overrides"],
    },
  });
  const { register, handleSubmit, formState, setValue, getValues } = form;
  const overrides = useFieldArray({ control: form.control, name: "overrides" });
  const levels = useWatch({ control: form.control, name: "levels" });
  const quantities = useWatch({ control: form.control, name: "quantities" });
  const overrideValues = useWatch({ control: form.control, name: "overrides" });

  const quantityFor = (level: MvpLevel) =>
    quantities.find((q) => q.level === level && q.difficulty === null)?.quantity;
  const setQuantity = (level: MvpLevel, quantity: number) => {
    const rest = getValues("quantities").filter(
      (q) => !(q.level === level && q.difficulty === null),
    );
    setValue("quantities", [...rest, { level, difficulty: null, quantity }], {
      shouldDirty: true,
      shouldValidate: formState.isSubmitted,
    });
  };
  const toggleLevel = (level: MvpLevel, checked: boolean) => {
    const current = getValues("levels");
    const next = checked
      ? MVP_LEVELS.filter((l) => l === level || current.includes(l))
      : current.filter((l) => l !== level);
    setValue("levels", next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    if (!checked) {
      setValue(
        "quantities",
        getValues("quantities").filter((q) => q.level !== level),
        { shouldDirty: true },
      );
    }
  };

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit({ ...values, overrides: values.overrides });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  const messages = [
    ...collectErrorMessages(formState.errors),
    ...(serverError ? [serverError] : []),
  ];

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      <FormErrorSummary messages={messages} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome do conjunto" required error={formState.errors.name?.message}>
          <Input {...register("name")} />
        </Field>
        <Field label="Descrição (opcional)" error={formState.errors.description?.message}>
          <Textarea rows={2} {...register("description")} />
        </Field>
      </div>

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Níveis e quantidade por aluno</legend>
        <p className="text-muted-foreground text-xs">
          Marque os níveis do conjunto e quantos exercícios cada aluno recebe em cada nível.
        </p>
        {MVP_LEVELS.map((level) => {
          const checked = levels.includes(level);
          const qty = quantityFor(level);
          const qid = `qty-${level}`;
          return (
            <div key={level} className="flex flex-wrap items-center gap-4">
              <label className="inline-flex w-48 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={checked}
                  onChange={(e) => toggleLevel(level, e.target.checked)}
                />
                <span>
                  <span className="sr-only">Nível: </span>
                  {LEVEL_LABELS[level]}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Label htmlFor={qid} className={checked ? "" : "text-muted-foreground"}>
                  Exercícios por aluno — {LEVEL_LABELS[level]}
                </Label>
                <Input
                  id={qid}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="w-24"
                  disabled={!checked}
                  value={checked && qty !== undefined && !Number.isNaN(qty) ? qty : ""}
                  onChange={(e) =>
                    setQuantity(level, e.target.value === "" ? Number.NaN : Number(e.target.value))
                  }
                />
              </div>
            </div>
          );
        })}
        <p className="text-muted-foreground text-xs">Dashboard chega na v1.1.</p>
      </fieldset>

      <fieldset className="grid gap-2 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Dificuldades</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {DIFFICULTIES.map((d) => (
            <label key={d} className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={d}
                className="accent-primary size-4"
                {...register("difficulties")}
              />
              {DIFFICULTY_LABELS[d]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Exceções por aluno ou turma</legend>
        <p className="text-muted-foreground text-xs">
          Opcional: troque a quantidade de um nível para um aluno ou uma turma específica.
        </p>
        {overrides.fields.map((f, i) => {
          const type = overrideValues[i]?.targetType;
          const options = type === "STUDENT" ? students : classrooms;
          return (
            <div
              key={f.id}
              className="grid items-end gap-2 sm:grid-cols-[8rem_1fr_10rem_7rem_auto]"
            >
              <Field label={`Tipo (exceção ${i + 1})`}>
                <NativeSelect {...register(`overrides.${i}.targetType`)}>
                  <option value="STUDENT">Aluno</option>
                  <option value="CLASSROOM">Turma</option>
                </NativeSelect>
              </Field>
              <Field
                label={`Quem (exceção ${i + 1})`}
                error={formState.errors.overrides?.[i]?.targetId?.message}
              >
                <NativeSelect {...register(`overrides.${i}.targetId`)}>
                  <option value="">Escolha…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label={`Nível (exceção ${i + 1})`}
                error={formState.errors.overrides?.[i]?.level?.message}
              >
                <NativeSelect {...register(`overrides.${i}.level`)}>
                  {MVP_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field
                label={`Quantidade (exceção ${i + 1})`}
                error={formState.errors.overrides?.[i]?.quantity?.message}
              >
                <Input
                  type="number"
                  min={1}
                  {...register(`overrides.${i}.quantity`, { valueAsNumber: true })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover exceção ${i + 1}`}
                onClick={() => overrides.remove(i)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          );
        })}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              overrides.append({
                targetType: "STUDENT",
                targetId: "",
                level: levels[0] ?? "FUNDAMENTAL",
                quantity: 1,
              })
            }
          >
            <Plus aria-hidden="true" /> Adicionar exceção
          </Button>
        </div>
      </fieldset>

      <div>
        <Button type="submit" disabled={formState.isSubmitting}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
