import { z } from "zod";

/**
 * PATCH /api/admin/users/:id — INSTITUTION_ADMIN edita nome, e-mail e ativo.
 * Papel continua em /role (chave `role` aqui → 422). Corpo vazio → 422.
 * E-mail normalizado em minúsculas (único na plataforma).
 */
export const userUpdateSchema = z
  .strictObject(
    {
      name: z.string().trim().min(1, { error: "Informe o nome" }).max(120),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email({ error: "E-mail inválido" }).max(254)),
      active: z.boolean({ error: "active deve ser true ou false" }),
    },
    { error: "Campo não permitido (papel: use PATCH /api/admin/users/:id/role)" },
  )
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    error: "Informe ao menos um campo: name, email ou active",
  });

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
