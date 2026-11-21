import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "@/lib/env";

/**
 * Cliente Prisma PREGUIÇOSO: só é criado no primeiro uso (ex.: `prisma.user.findMany`),
 * não ao importar o módulo. Assim `next build` (e qualquer import em tempo de build)
 * funciona sem DATABASE_URL — verificado com `env -u DATABASE_URL npm run build`.
 * A API exportada é a mesma (`prisma`, usado também por `forTenant` em tenant-db.ts);
 * sem DATABASE_URL o erro aparece no primeiro acesso, com a mensagem de requireEnv.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = createPrismaClient();
    // Em produção também guardamos no módulo; em dev o globalThis sobrevive ao HMR.
    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

/**
 * Metadados estáticos do schema que bibliotecas leem na inicialização (o adapter
 * Prisma do Better Auth lê `_runtimeDataModel` ao montar `auth`, em tempo de build).
 * Sem DATABASE_URL eles vêm de um cliente "só metadados" cujo pool nunca conecta.
 */
const STATIC_METADATA = new Set<PropertyKey>(["_runtimeDataModel"]);
let metadataClient: PrismaClient | undefined;

function metadataOnlyClient(): PrismaClient {
  metadataClient ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: "postgresql://metadata-only@127.0.0.1:1/unused" }),
  });
  return metadataClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (STATIC_METADATA.has(prop) && !globalForPrisma.prisma && !process.env.DATABASE_URL) {
      return Reflect.get(metadataOnlyClient(), prop);
    }
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has: (_target, prop) => Reflect.has(getPrisma(), prop),
});
