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
import { Textarea } from "@/components/ui/textarea";
import { DIFFICULTY_LABELS, LEVEL_LABELS } from "@/lib/domain/labels";
import {
  DIFFICULTIES,
  MVP_LEVELS,
  type Classroom,
  type Difficulty,
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
  const difficulties = useWatch({ control: form.control, name: "difficulties" });
  const overrideValues = useWatch({ control: form.control, name: "overrides" });

  const quantityFor = (level: MvpLevel, difficulty: Difficulty) =>
    quantities.find((q) => q.level === level && q.difficulty === difficulty)?.quantity;
  const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted };
  /** Quantidade por nível + dificuldade; preencher marca a dificuldade no conjunto. */
  const setQuantity = (level: MvpLevel, difficulty: Difficulty, raw: string) => {
    const rest = getValues("quantities").filter(
      (q) => !(q.level === level && q.difficulty === difficulty),
    );
    setValue(
      "quantities",
      raw === "" ? rest : [...rest, { level, difficulty, quantity: Number(raw) }],
      opts,
    );
    if (raw !== "" && !getValues("difficulties").includes(difficulty)) {
      setValue(
        "difficulties",
        DIFFICULTIES.filter((d) => d === difficulty || getValues("difficulties").includes(d)),
        opts,
      );
    }
  };
  const toggleLevel = (level: MvpLevel, checked: boolean) => {
    const current = getValues("levels");
    setValue(
      "levels",
      checked
        ? MVP_LEVELS.filter((l) => l === level || current.includes(l))
        : current.filter((l) => l !== level),
      opts,
    );
    if (!checked)
      setValue(
        "quantities",
        getValues("quantities").filter((q) => q.level !== level),
        opts,
      );
  };
  const toggleDifficulty = (difficulty: Difficulty, checked: boolean) => {
    const current = getValues("difficulties");
    setValue(
      "difficulties",
      checked
        ? DIFFICULTIES.filter((d) => d === difficulty || current.includes(d))
        : current.filter((d) => d !== difficulty),
      opts,
    );
    if (!checked)
      setValue(
        "quantities",
        getValues("quantities").filter((q) => q.difficulty !== difficulty),
        opts,
      );
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

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="grid content-start gap-2 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">Níveis</legend>
          {MVP_LEVELS.map((level) => (
            <label key={level} className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={levels.includes(level)}
                onChange={(e) => toggleLevel(level, e.target.checked)}
              />
              <span>
                <span className="sr-only">Nível: </span>
                {LEVEL_LABELS[level]}
              </span>
            </label>
          ))}
          <p className="text-muted-foreground text-xs">Dashboard chega na v1.1.</p>
        </fieldset>
        <fieldset className="grid content-start gap-2 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">Dificuldades</legend>
          {DIFFICULTIES.map((d) => (
            <label key={d} className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={difficulties.includes(d)}
                onChange={(e) => toggleDifficulty(d, e.target.checked)}
              />
              {DIFFICULTY_LABELS[d]}
            </label>
          ))}
        </fieldset>
      </div>

      <fieldset className="grid gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Exercícios por aluno</legend>
        <p className="text-muted-foreground text-xs">
          Quantos exercícios cada aluno recebe em cada nível e dificuldade. Marque o nível para
          liberar a linha; deixe em branco as dificuldades que não usar.
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <caption className="sr-only">
              Quantidade de exercícios por aluno, por nível e dificuldade
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left font-medium">
                  Nível
                </th>
                {DIFFICULTIES.map((d) => (
                  <th key={d} scope="col" className="p-2 text-left font-medium whitespace-nowrap">
                    {DIFFICULTY_LABELS[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MVP_LEVELS.map((level) => {
                const enabled = levels.includes(level);
                return (
                  <tr key={level} className={enabled ? "" : "text-muted-foreground"}>
                    <th scope="row" className="p-2 text-left font-medium">
                      {LEVEL_LABELS[level]}
                    </th>
                    {DIFFICULTIES.map((d) => {
                      const qty = quantityFor(level, d);
                      return (
                        <td key={d} className="p-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className="w-20"
                            aria-label={`Exercícios por aluno — ${LEVEL_LABELS[level]} — ${DIFFICULTY_LABELS[d]}`}
                            disabled={!enabled}
                            value={enabled && qty !== undefined && !Number.isNaN(qty) ? qty : ""}
                            onChange={(e) => setQuantity(level, d, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
