import { z } from "zod";

import { TENANT_ROLES } from "@/lib/roles";

/** Convite (TA-007). E-mail normalizado (minúsculo); SUPER_ADMIN não é convidável. */
export const invitationInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "E-mail inválido" })),
  role: z.enum(TENANT_ROLES, { error: "Papel inválido" }),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export type InvitationInput = z.infer<typeof invitationInputSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
