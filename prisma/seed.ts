import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Usuário administrador inicial, sem senha: o fluxo de senha chega com TA-001/TA-033.
  await prisma.user.upsert({
    where: { email: "admin@training-area.local" },
    update: {},
    create: { email: "admin@training-area.local", name: "Administrador", role: "ADMIN" },
  });
  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
