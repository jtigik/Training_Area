import { z } from "zod";
import { DIFFICULTIES, INSTITUTION_ROLES, MVP_LEVELS } from "../domain/types";

const required = (label: string) => z.string().trim().min(1, `${label} é obrigatório.`);
const email = (label = "E-mail") =>
  z.string().trim().min(1, `${label} é obrigatório.`).pipe(z.email("Informe um e-mail válido."));
/** Formulários só aceitam os níveis do MVP (Dashboard fica para a v1.1). */
const level = z.enum(MVP_LEVELS, { message: "Escolha um nível do MVP." });
const positiveInt = z
  .number({ message: "Informe a quantidade." })
  .int("A quantidade deve ser um número inteiro.")
  .min(1, "A quantidade deve ser maior que zero.");

/* ----------------------------- Super admin ----------------------------- */

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;

export const institutionFormSchema = z.object({
  name: required("Nome").max(120, "Use no máximo 120 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Use pelo menos 3 caracteres.")
    .max(48, "Use no máximo 48 caracteres.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens."),
  /** Domínios separados por vírgula ou espaço. */
  domains: z
    .string()
    .trim()
    .transform((v) =>
      v
        .split(/[\s,;]+/)
        .map((d) => d.toLowerCase())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().regex(DOMAIN_RE, "Domínio inválido (ex.: escola.edu.br)."))
        .min(1, "Informe pelo menos um domínio."),
    ),
});
export type InstitutionFormInput = z.input<typeof institutionFormSchema>;

export const newInstitutionFormSchema = institutionFormSchema.extend({
  adminName: required("Nome do admin").max(120, "Use no máximo 120 caracteres."),
  adminEmail: email("E-mail do admin"),
});
export type NewInstitutionFormInput = z.input<typeof newInstitutionFormSchema>;
export type NewInstitutionFormValues = z.output<typeof newInstitutionFormSchema>;

/* ------------------------- Admin da instituição ------------------------ */

export const userFormSchema = z.object({
  name: required("Nome").max(120, "Use no máximo 120 caracteres."),
  email: email(),
  role: z.enum(INSTITUTION_ROLES, { message: "Escolha um papel." }),
});
export type UserFormValues = z.infer<typeof userFormSchema>;

const thresholdPercent = (label: string) =>
  z
    .number({ message: `Informe o mínimo de ${label}.` })
    .int(`O mínimo de ${label} deve ser inteiro.`)
    .min(1, `O mínimo de ${label} deve ficar entre 1 e 100.`)
    .max(100, `O mínimo de ${label} deve ficar entre 1 e 100.`);

/** Limiares de conceito (ND abaixo de ED); exige ED ≤ D ≤ PD, como o BE2. */
export const conceptThresholdsSchema = z
  .object({ ED: thresholdPercent("ED"), D: thresholdPercent("D"), PD: thresholdPercent("PD") })
  .refine((t) => t.ED <= t.D && t.D <= t.PD, {
    message: "Os mínimos devem seguir a ordem ED ≤ D ≤ PD.",
    path: ["PD"],
  });

export const settingsFormSchema = z.object({
  instanceName: required("Nome da instância").max(80, "Use no máximo 80 caracteres."),
  openSignup: z.boolean(),
  conceptThresholds: conceptThresholdsSchema,
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

/* ------------------------------ Professor ------------------------------ */

export const sectionFormSchema = z.object({
  title: required("Título").max(150, "Use no máximo 150 caracteres."),
  body: required("Conteúdo"),
  level: level.nullable(),
});
export type SectionFormValues = z.infer<typeof sectionFormSchema>;

export const quantityRuleSchema = z.object({
  level,
  difficulty: z.enum(DIFFICULTIES).nullable(),
  quantity: positiveInt,
});

export const quantityOverrideSchema = z.object({
  targetType: z.enum(["STUDENT", "CLASSROOM"]),
  targetId: z.string().min(1, "Escolha o aluno ou a turma."),
  level,
  quantity: positiveInt,
});

export const exerciseSetFormSchema = z
  .object({
    name: required("Nome do conjunto").max(120, "Use no máximo 120 caracteres."),
    description: z.string().max(500, "Use no máximo 500 caracteres."),
    levels: z.array(level).min(1, "Selecione pelo menos um nível."),
    difficulties: z.array(z.enum(DIFFICULTIES)).min(1, "Selecione pelo menos uma dificuldade."),
    quantities: z.array(quantityRuleSchema),
    overrides: z.array(quantityOverrideSchema),
  })
  .superRefine((v, ctx) => {
    v.levels.forEach((l) => {
      if (!v.quantities.some((q) => q.level === l)) {
        ctx.addIssue({
          code: "custom",
          path: ["quantities"],
          message: "Informe a quantidade de cada nível selecionado.",
        });
      }
    });
    const seen = new Set<string>();
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
  level,
  difficulty: z.enum(DIFFICULTIES, { message: "Escolha uma dificuldade." }),
  hint: z.string().max(500, "Use no máximo 500 caracteres."),
});
export type ExerciseMetaValues = z.infer<typeof exerciseMetaSchema>;

export const bankMetaSchema = exerciseMetaSchema.extend({
  tags: z.string().max(200, "Use no máximo 200 caracteres."),
});
export type BankMetaValues = z.infer<typeof bankMetaSchema>;

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
    label: z.string().trim().max(60, "Use no máximo 60 caracteres."),
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

export const rejectFeedbackSchema = z.object({
  reason: required("Motivo").max(500, "Use no máximo 500 caracteres."),
});

/* ------------------------------ Upload .xlsx ------------------------------ */

export const XLSX_MAX_BYTES = 2 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Valida nome, tipo e tamanho do arquivo antes de ler. Retorna a mensagem de erro ou null. */
export function validateXlsxFile(file: Pick<File, "name" | "size" | "type">): string | null {
  if (!/\.xlsx$/i.test(file.name)) return "Envie um arquivo .xlsx (Excel 2007 ou mais recente).";
  if (file.type && file.type !== XLSX_MIME && file.type !== "application/octet-stream") {
    return "O arquivo não parece ser uma planilha .xlsx.";
  }
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > XLSX_MAX_BYTES) return "O arquivo passa de 2 MB. Divida em arquivos menores.";
  return null;
}

/* ------------------------- Células da planilha ------------------------- */

const cellScalarSchema = z.union([z.number(), z.string(), z.boolean(), z.null()]);

/**
 * Conteúdo de célula combinado com BE1/BE2: number | string | boolean | null |
 * { f: "=...", v? }. String iniciada por "=" é texto literal; fórmula só em `{ f }`.
 */
export const cellValueSchema = z.union([
  cellScalarSchema,
  z.object({
    f: z.string().regex(/^=.+/, 'A fórmula deve começar com "=".'),
    v: cellScalarSchema.optional(),
  }),
]);

const addressSchema = z.string().regex(/^[A-Z][1-9][0-9]*$/, "Endereço de célula inválido.");

export const spreadsheetGridSchema = z.object({
  rows: z.number().int().min(1).max(50),
  cols: z.number().int().min(1).max(26),
  cells: z.record(addressSchema, z.object({ value: cellValueSchema, locked: z.boolean() })),
});

export const answerCellSchema = z
  .object({
    kind: z.enum(["VALUE", "FORMULA"]),
    expected: cellValueSchema,
    tolerance: z.number().min(0).optional(),
  })
  .refine(
    (a) => (a.kind === "FORMULA") === (typeof a.expected === "object" && a.expected !== null),
    { message: "Gabarito de fórmula usa { f }; de valor, um literal.", path: ["expected"] },
  );
