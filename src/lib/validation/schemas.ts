import { z } from "zod";
import { DIFFICULTIES, LEVELS, ROLES } from "../domain/types";

const required = (label: string) => z.string().trim().min(1, `${label} é obrigatório.`);

export const userFormSchema = z.object({
  name: required("Nome").max(120, "Use no máximo 120 caracteres."),
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório.")
    .pipe(z.email("Informe um e-mail válido.")),
  role: z.enum(ROLES, { message: "Escolha um papel." }),
  onboarding: z.enum(["convite", "senha_temporaria"]),
});
export type UserFormValues = z.infer<typeof userFormSchema>;

export const instanceConfigSchema = z.object({
  name: required("Nome da instância").max(80, "Use no máximo 80 caracteres."),
  openSignup: z.boolean(),
});
export type InstanceConfigValues = z.infer<typeof instanceConfigSchema>;

export const sectionFormSchema = z.object({
  title: required("Título").max(150, "Use no máximo 150 caracteres."),
  body: required("Conteúdo"),
  level: z.enum(LEVELS).nullable(),
});
export type SectionFormValues = z.infer<typeof sectionFormSchema>;

export const quantityRuleSchema = z.object({
  level: z.enum(LEVELS),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  quantity: z
    .number({ message: "Informe um número." })
    .int("Use um número inteiro.")
    .min(1, "A quantidade deve ser maior que zero."),
});

export const quantityOverrideSchema = z.object({
  targetType: z.enum(["aluno", "turma"]),
  targetId: z.string().min(1, "Escolha o aluno ou a turma."),
  level: z.enum(LEVELS),
  quantity: z
    .number({ message: "Informe um número." })
    .int("Use um número inteiro.")
    .min(1, "A quantidade deve ser maior que zero."),
});

export const exerciseSetFormSchema = z
  .object({
    name: required("Nome").max(120, "Use no máximo 120 caracteres."),
    description: z.string().max(500, "Use no máximo 500 caracteres."),
    levels: z.array(z.enum(LEVELS)).min(1, "Selecione pelo menos um nível."),
    difficulties: z.array(z.enum(DIFFICULTIES)).min(1, "Selecione pelo menos uma dificuldade."),
    quantities: z.array(quantityRuleSchema),
    overrides: z.array(quantityOverrideSchema),
  })
  .superRefine((v, ctx) => {
    v.quantities.forEach((q, i) => {
      if (!v.levels.includes(q.level)) {
        ctx.addIssue({
          code: "custom",
          path: ["quantities", i, "level"],
          message: "Nível não selecionado no conjunto.",
        });
      }
      if (q.difficulty && !v.difficulties.includes(q.difficulty)) {
        ctx.addIssue({
          code: "custom",
          path: ["quantities", i, "difficulty"],
          message: "Dificuldade não selecionada no conjunto.",
        });
      }
    });
    const seen = new Set<string>();
    v.quantities.forEach((q, i) => {
      const key = `${q.level}:${q.difficulty ?? "*"}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["quantities", i, "difficulty"],
          message: "Recorte repetido.",
        });
      }
      seen.add(key);
    });
    v.overrides.forEach((o, i) => {
      if (!v.levels.includes(o.level)) {
        ctx.addIssue({
          code: "custom",
          path: ["overrides", i, "level"],
          message: "Nível não selecionado no conjunto.",
        });
      }
    });
  });
export type ExerciseSetFormValues = z.infer<typeof exerciseSetFormSchema>;

export const exerciseMetaSchema = z.object({
  title: required("Título").max(150, "Use no máximo 150 caracteres."),
  statement: required("Enunciado"),
  level: z.enum(LEVELS, { message: "Escolha um nível." }),
  difficulty: z.enum(DIFFICULTIES, { message: "Escolha uma dificuldade." }),
  hint: z.string().max(500, "Use no máximo 500 caracteres."),
  published: z.boolean(),
});
export type ExerciseMetaValues = z.infer<typeof exerciseMetaSchema>;

export const feedbackBandSchema = z
  .object({
    minPercent: z
      .number({ message: "Informe um número." })
      .int()
      .min(0, "Mínimo 0.")
      .max(100, "Máximo 100."),
    maxPercent: z
      .number({ message: "Informe um número." })
      .int()
      .min(0, "Mínimo 0.")
      .max(100, "Máximo 100."),
    label: required("Rótulo").max(60, "Use no máximo 60 caracteres."),
    template: required("Texto").max(1000, "Use no máximo 1000 caracteres."),
  })
  .refine((b) => b.minPercent <= b.maxPercent, {
    path: ["maxPercent"],
    message: "O máximo deve ser maior ou igual ao mínimo.",
  });

export const feedbackFormSchema = z.object({
  bands: z.array(feedbackBandSchema).min(1, "Cadastre pelo menos uma faixa."),
});
export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;
