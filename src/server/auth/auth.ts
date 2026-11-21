import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { customSession, genericOAuth } from "better-auth/plugins";

import { ROLES } from "@/lib/roles";
import {
  GENERIC_SIGN_IN_ERROR,
  NO_TENANT_SIGN_IN_ERROR,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/validation/auth";
import { readAuthEnv } from "@/server/auth/config";
import { decideProvisioning, emailDomain } from "@/server/auth/provisioning";
import { getTenantSummary } from "@/server/auth/tenant-summary";
import { prisma } from "@/server/db";
import { forTenant } from "@/server/tenant-db";

const SEVEN_DAYS = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const authEnv = readAuthEnv();

/**
 * Modo mock (E2E): Google/Microsoft como provedores genéricos com os MESMOS ids,
 * então signIn.social({ provider }) e o callback /api/auth/callback/{id} são
 * idênticos ao modo nativo. Só um conjunto é registrado por vez.
 */
const mockOAuthPlugins =
  authEnv.oauthMode === "mock"
    ? [
        genericOAuth({
          config: authEnv.mockProviders.map((p) => ({
            providerId: p.providerId,
            clientId: p.clientId,
            clientSecret: p.clientSecret,
            authorizationUrl: p.authorizationUrl,
            tokenUrl: p.tokenUrl,
            userInfoUrl: p.userInfoUrl,
            scopes: ["openid", "email", "profile"],
            pkce: true,
            // Identificador estável da conta: "sub" (padrão OIDC) ou "id".
            accountSubject: ({ profile }) => String(profile.sub ?? profile.id ?? ""),
          })),
        }),
      ]
    : [];

/**
 * Better Auth (TA-001, TA-005, TA-033) — multi-tenant.
 * - Lançamento: Google e Microsoft (socialProviders), ativados quando as
 *   variáveis existem. Em dev/teste, AUTH_OAUTH_MOCK_BASE_URL troca ambos por
 *   genericOAuth apontando para um provedor falso (config.ts). E-mail+senha só com AUTH_EMAIL_PASSWORD_ENABLED=true fora
 *   de produção (seed/E2E).
 * - role, tenantId e active são campos extras com input: false (o cliente
 *   nunca os define). No primeiro login o usuário é vinculado a um tenant por
 *   convite ou domínio (provisioning.ts); sem vínculo, o cadastro é recusado.
 * - Sem cookie cache: a sessão é lida do banco a cada requisição (troca de
 *   papel/desativação valem na próxima requisição). Cookies httpOnly,
 *   SameSite=Lax, Secure em produção (padrões do Better Auth).
 */
const authOptions = {
  appName: "Training Area",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: {
    // IDs gerados pelo banco (@default(cuid()) no schema).
    database: { generateId: false },
  },
  emailAndPassword: {
    enabled: authEnv.emailPasswordEnabled,
    disableSignUp: true, // contas de dev vêm do seed
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  socialProviders: {
    ...(authEnv.google && { google: { ...authEnv.google, prompt: "select_account" as const } }),
    ...(authEnv.microsoft && {
      microsoft: { ...authEnv.microsoft, prompt: "select_account" as const },
    }),
  },
  account: {
    accountLinking: {
      enabled: true,
      // Vincula Google/Microsoft a um usuário pré-existente com o mesmo e-mail
      // (ex.: criado pelo seed/admin); ambos verificam o e-mail.
      trustedProviders: ["google", "microsoft"],
    },
  },
  session: {
    expiresIn: SEVEN_DAYS,
    updateAge: ONE_DAY,
  },
  user: {
    additionalFields: {
      role: { type: [...ROLES], required: false, defaultValue: "ALUNO", input: false },
      tenantId: { type: "string", required: false, input: false },
      active: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Antes de existir tenant (descoberta por convite/domínio): cliente base, intencional.
        before: async (user) => {
          const email = user.email.toLowerCase();
          const [invitations, domainTenants] = await Promise.all([
            prisma.invitation.findMany({
              where: { email, acceptedAt: null, tenant: { active: true } },
              select: { id: true, tenantId: true, role: true, expiresAt: true, createdAt: true },
            }),
            prisma.tenant.findMany({
              where: {
                active: true,
                autoJoinByDomain: true,
                emailDomains: { has: emailDomain(email) },
              },
              select: { id: true, emailDomains: true },
            }),
          ]);
          const decision = decideProvisioning(
            email,
            invitations.flatMap((i) => (i.role === "SUPER_ADMIN" ? [] : [{ ...i, role: i.role }])),
            domainTenants,
          );
          if (!decision) {
            throw new APIError("FORBIDDEN", { message: NO_TENANT_SIGN_IN_ERROR });
          }
          return {
            data: {
              ...user,
              email,
              tenantId: decision.tenantId,
              role: decision.role,
              active: true,
            },
          };
        },
        after: async (user) => {
          if (typeof user.tenantId !== "string") return;
          await forTenant(user.tenantId).invitation.updateMany({
            where: { email: user.email.toLowerCase(), acceptedAt: null },
            data: { acceptedAt: new Date() },
          });
        },
      },
    },
    session: {
      create: {
        // Usuário ou instituição desativados não autenticam (TA-006).
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { active: true, role: true, tenant: { select: { active: true } } },
          });
          const tenantOk = user?.role === "SUPER_ADMIN" || user?.tenant?.active === true;
          if (!user?.active || !tenantOk) {
            throw new APIError("UNAUTHORIZED", { message: GENERIC_SIGN_IN_ERROR });
          }
        },
      },
    },
  },
  plugins: [...mockOAuthPlugins],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...authOptions.plugins,
    // get-session / useSession() / auth.api.getSession incluem user.tenant
    // ({ id, name, slug } | null para SUPER_ADMIN). Resumo em cache por 60 s
    // (tenant-summary.ts) para não somar uma consulta a cada leitura de sessão.
    customSession(
      async ({ user, session }) => ({
        user: { ...user, tenant: await getTenantSummary(user.tenantId) },
        session,
      }),
      authOptions,
    ),
    nextCookies(), // precisa ser o último
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
