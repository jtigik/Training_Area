import { z } from "zod";

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, {
    error: "Domínio inválido (ex.: escola.edu.br)",
  });

export const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, {
    error: "Use letras minúsculas, números e hífens",
  });

/** SUPER_ADMIN cria instituição. autoJoinByDomain é opcional e desligado por padrão. */
export const tenantCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: tenantSlugSchema,
  emailDomains: z.array(domain).max(20).default([]),
  autoJoinByDomain: z.boolean().default(false),
  locale: z.string().trim().min(2).max(10).default("pt-BR"),
});

export const tenantUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: tenantSlugSchema,
    emailDomains: z.array(domain).max(20),
    autoJoinByDomain: z.boolean(),
    locale: z.string().trim().min(2).max(10),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { error: "Nada para atualizar" });

export type TenantCreateInput = z.infer<typeof tenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
