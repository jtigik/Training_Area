# Training Area

Plataforma web de treinamento em Excel: o professor publica conteúdo e exercícios de fórmulas, o aluno pratica em uma grade tipo planilha e recebe correção e feedback, e o administrador gere a instância.

## Stack

| Camada         | Tecnologia                                                              |
| -------------- | ----------------------------------------------------------------------- |
| App web        | Next.js 16 (App Router, `src/`), React 19, TypeScript (strict)          |
| Banco de dados | PostgreSQL 17 (Docker Compose)                                          |
| ORM            | Prisma 7 (`prisma-client` + `@prisma/adapter-pg`)                       |
| Qualidade      | ESLint 9 (`eslint-config-next`) + Prettier 3 (`eslint-config-prettier`) |
| Testes         | Vitest + Testing Library (jsdom) e Playwright (e2e)                     |
| Entrega        | Dockerfile multi-stage (saída `standalone`), GitHub Actions             |

## Pré-requisitos

- **Node.js 24 LTS** (veja `.nvmrc`; com nvm: `nvm use`) e npm 10+
- **Docker** com Docker Compose v2 (para o PostgreSQL)
- Git 2.5+ (para `git worktree`)

## Primeiros passos

```bash
git clone https://github.com/jtigik/Training_Area.git
cd Training_Area
nvm use                      # Node 24
cp .env.example .env         # ajuste se precisar (porta, senha)
npm ci                       # instala dependências e gera o Prisma Client (postinstall)
npm run db:up                # sobe o PostgreSQL e espera o healthcheck
npm run db:migrate           # aplica as migrações (prisma migrate dev)
npm run db:seed              # opcional: cria o admin inicial admin@training-area.local
npm run dev                  # http://localhost:3000
```

Health check: `GET /api/health` → `{"status":"ok"}`.

### Stack completa em containers

```bash
docker compose --profile app up --build
```

Sobe `db` → `migrate` (aplica `prisma migrate deploy`) → `app` (imagem de produção em `http://localhost:${APP_PORT:-3000}`).

### Testes e2e

Na primeira vez, instale o navegador do Playwright:

```bash
npm run test:e2e:install     # chromium + dependências do sistema
npm run test:e2e             # sobe o `next dev` automaticamente
```

Com `CI=1`, o Playwright usa o build de produção (rode `npm run build` antes). Porta padrão 3000; para usar outra: `E2E_PORT=3100 npm run test:e2e`. Para testar um servidor já rodando: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.

## Scripts

| Script                                  | O que faz                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `dev`                                   | Servidor de desenvolvimento (Turbopack)                                         |
| `build`                                 | Build de produção (`.next/standalone`)                                          |
| `start`                                 | Roda o build standalone (copia `public` e `.next/static` e executa `server.js`) |
| `lint` / `lint:fix`                     | ESLint no projeto inteiro                                                       |
| `format` / `format:check`               | Prettier (escreve / só verifica)                                                |
| `typecheck`                             | Gera os tipos de rotas do Next e roda `tsc --noEmit`                            |
| `test` / `test:watch` / `test:coverage` | Vitest (unitários e de componentes)                                             |
| `test:e2e` / `test:e2e:install`         | Playwright / instala o Chromium                                                 |
| `db:up` / `db:down`                     | Sobe / derruba os containers do Compose                                         |
| `db:generate`                           | Gera o Prisma Client em `src/generated/prisma`                                  |
| `db:migrate`                            | Cria/aplica migrações em dev (`prisma migrate dev`)                             |
| `db:deploy`                             | Aplica migrações pendentes (produção/CI)                                        |
| `db:seed`                               | Executa `prisma/seed.ts`                                                        |
| `db:studio`                             | Abre o Prisma Studio                                                            |
| `db:reset`                              | Recria o banco do zero (apaga dados!)                                           |

## Estrutura de pastas

```
.
├── .github/workflows/ci.yml   # CI: lint, format, typecheck, testes, build e e2e
├── e2e/                       # testes end-to-end (Playwright)
├── prisma/
│   ├── migrations/            # migrações SQL versionadas
│   ├── schema.prisma          # modelo de dados
│   └── seed.ts                # dados iniciais
├── public/                    # arquivos estáticos
├── src/
│   ├── app/                   # rotas do App Router (páginas, layouts, route handlers em api/)
│   ├── components/            # componentes React reutilizáveis (+ testes *.test.tsx ao lado)
│   ├── generated/prisma/      # Prisma Client gerado (não versionado)
│   ├── lib/                   # utilitários puros, compartilhados entre cliente e servidor
│   ├── server/                # código só de servidor (acesso ao banco, serviços)
│   └── test/                  # setup do Vitest
├── docker-compose.yml         # PostgreSQL (+ perfil "app" com migrate e app)
├── Dockerfile                 # build multi-stage, usuário não-root
├── prisma.config.ts           # configuração do Prisma CLI (schema, migrações, seed, URL)
├── playwright.config.ts
└── vitest.config.mts
```

Convenções:

- Imports absolutos com `@/` (ex.: `import { prisma } from "@/server/db"`).
- Testes unitários ficam ao lado do código (`*.test.ts[x]`); e2e em `e2e/`.
- Código que acessa o banco fica em `src/server/` e importa `server-only`.

## Fluxo de trabalho com git worktree

Cada pessoa do time trabalha em um worktree próprio, ao lado do clone principal, em uma branch própria:

```bash
# a partir do clone principal (ex.: training_area/repo)
git fetch origin
git worktree add ../wt-<papel> -b <tipo>/<descricao> origin/main
# ex.: git worktree add ../wt-backend1 -b feat/ta-001-auth origin/main

cd ../wt-<papel>
cp ../repo/.env .env          # .env não é versionado: copie para cada worktree
npm ci
npm run dev -- -p 3001        # use uma porta diferente por worktree
```

- Todos os worktrees compartilham o mesmo PostgreSQL do Compose; se precisar de isolamento, use um banco por worktree mudando `DATABASE_URL` (ex.: `.../training_area_backend1`).
- `node_modules`, `.next` e `src/generated` são locais de cada worktree.
- Para remover: `git worktree remove ../wt-<papel>`; liste com `git worktree list`.
- Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `ci:`). PRs para `main` precisam da CI verde.

## Licença

MIT — veja [LICENSE](LICENSE).
