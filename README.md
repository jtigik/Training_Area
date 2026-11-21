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
cp .env.example .env         # ajuste se precisar (veja "Variáveis de ambiente")
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

## Variáveis de ambiente

Modelo em [`.env.example`](.env.example). A validação fica em `src/lib/env.ts` (`validateServerEnv`) e roda na inicialização do servidor (`src/instrumentation.ts`), não durante o `next build`. Integrações externas (OAuth, IA) são opcionais em dev e teste; em produção o servidor só sobe se a configuração for válida.

| Variável                                                        | Obrigatória?                         | Para que serve                                                                        | Valor na CI                                                                 |
| --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`           | Só para o Compose                    | Credenciais do container PostgreSQL                                                   | `training` / `training` / `training_area` (service do job e2e)              |
| `POSTGRES_PORT`                                                 | Não (padrão `5432`)                  | Porta do Postgres no host                                                             | —                                                                           |
| `DATABASE_URL`                                                  | Sim, para banco, migrações e seed    | Conexão do Prisma                                                                     | `postgresql://training:training@localhost:5432/training_area?schema=public` |
| `APP_PORT`                                                      | Não (padrão `3000`)                  | Porta do app no perfil `app` do Compose                                               | —                                                                           |
| `AUTH_SECRET`                                                   | **Sim em produção**                  | Chave do Auth.js para assinar sessão e tokens (`openssl rand -base64 32`)             | secret `AUTH_SECRET` ou valor fictício                                      |
| `AUTH_URL`                                                      | Recomendado em produção              | URL pública do app, usada nos callbacks OAuth                                         | `http://localhost:3000`                                                     |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`                         | Não (sempre em par)                  | OAuth Google. Callback: `<AUTH_URL>/api/auth/callback/google`                         | secrets ou valores fictícios                                                |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Não (sempre em par)                  | OAuth Microsoft Entra ID. Callback: `<AUTH_URL>/api/auth/callback/microsoft-entra-id` | secrets ou valores fictícios                                                |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER`                                | Não                                  | Issuer do Entra ID: `https://login.microsoftonline.com/<tenant-id ou common>/v2.0`    | `.../common/v2.0`                                                           |
| `AI_PROVIDER`                                                   | Não (padrão `mock`)                  | Provedor de IA do feedback: `openai`, `anthropic` ou `mock`                           | `mock`                                                                      |
| `AI_API_KEY`                                                    | Sim se `AI_PROVIDER` ≠ `mock`        | Chave da API do provedor de IA                                                        | vazio                                                                       |
| `AI_MODEL`                                                      | Não                                  | Modelo do provedor (vazio = padrão definido no código)                                | vazio                                                                       |
| `TENANT_RESOLUTION`                                             | Não (padrão `single`)                | Como o tenant é identificado: `single`, `path` (`/t/<slug>/...`) ou `subdomain`       | `single`                                                                    |
| `DEFAULT_TENANT_SLUG`                                           | Não (padrão `default`)               | Tenant usado em `single` e como fallback                                              | `default`                                                                   |
| `APP_ROOT_DOMAIN`                                               | Sim se `TENANT_RESOLUTION=subdomain` | Domínio raiz dos subdomínios (ex.: `training.example.com`)                            | vazio                                                                       |

Notas:

- Os nomes seguem a convenção do Auth.js (`AUTH_*`), que lê essas variáveis automaticamente. A autenticação em si é implementada pelo backend (TA-001); aqui só está a configuração.
- Na CI, as variáveis de OAuth usam os secrets do repositório se existirem; se não existirem, usam valores fictícios. Nenhum teste chama Google, Microsoft ou provedor de IA.
- No Compose, o serviço `app` lê o `.env` (`env_file`) e sobrescreve só a `DATABASE_URL`.

## Multi-tenant (impacto na infra)

> **Premissa a confirmar pelo backend:** banco **compartilhado**, com coluna `tenant_id` nas tabelas de domínio. Ainda não há modelo `Tenant` no schema; ele entra junto com a modelagem do backend.

- **Banco:** uma única instância PostgreSQL e um único schema. O isolamento é lógico (`tenant_id` + filtros na camada de dados; Row-Level Security do Postgres pode ser avaliada depois). Migrações continuam únicas para todos os tenants.
- **Resolução do tenant:** `TENANT_RESOLUTION=single` (dev/piloto: sempre `DEFAULT_TENANT_SLUG`), `path` (`/t/<slug>/...`, não exige DNS) ou `subdomain` (`<slug>.<APP_ROOT_DOMAIN>`).
- **Subdomínios em produção:** exigem DNS curinga (`*.APP_ROOT_DOMAIN`), certificado TLS curinga e proxy/ingress que preserve o header `Host`.
- **OAuth com subdomínios:** os redirect URIs do Google e do Entra ID não aceitam curinga. Use um host fixo de autenticação (`AUTH_URL`) e redirecione ao tenant depois do login.
- **Dados e operação:** backups, seeds e exportações devem considerar o `tenant_id`. Os logs devem incluir o tenant para depuração.

## Segurança

### Headers HTTP (TA-033)

`next.config.ts` aplica a todas as rotas os headers definidos em `src/lib/security-headers.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` e uma CSP básica (`default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action` com `'self'` mais os endpoints OAuth do Google e da Microsoft, `img-src 'self' data: blob:`, `style-src`/`script-src` com `'unsafe-inline'`, `connect-src 'self'`). `'unsafe-eval'` e `ws:` só entram em desenvolvimento. Os testes unitários (`security-headers.test.ts`) e o e2e (`e2e/security-headers.spec.ts`) verificam os headers e a ausência de erros de CSP na home. Ao adicionar um domínio externo (CDN, analytics, provedor de IA chamado do navegador), atualize a CSP.

### Dependências (`npm audit`)

Em 21/11/2026, `npm audit` (e `npm audit --omit=dev`) reporta **0 vulnerabilidades**.

- **GHSA-7589-6fvf-x4pw** (ReDoS em `Schema.TemplateLiteral` do `effect` ≤ 3.22.0) chegava pela cadeia `prisma` → `@prisma/config` → `effect@3.20.0`. Ela gerava 3 alertas altos, inclusive com `--omit=dev`, porque o `@prisma/client` declara `prisma` como peer opcional.
- **Correção:** um `overrides` no `package.json` força `effect` `^3.22.1` só dentro de `@prisma/config` (versão resolvida: 3.22.5). Testado com `prisma generate`, `migrate status`/`migrate dev`, seed, lint, typecheck, testes unitários, build e e2e.
- **Manutenção:** ao atualizar o Prisma, verifique se a nova versão já traz `effect` ≥ 3.22.1. Se trouxer, remova o override. Se `npm ci` ou a CLI do Prisma quebrarem depois de um upgrade, o override é o primeiro suspeito. Responsável: DevOps.

## Licença

Copyright (C) 2026 Jeferson Tigik

Este projeto é software livre, distribuído sob a **GNU General Public License v3.0 only** (`GPL-3.0-only`). O texto integral, sem modificações, está em [LICENSE](LICENSE).

Você pode redistribuir e/ou modificar o projeto nos termos da GPL-3.0. Ele é distribuído na esperança de ser útil, mas **sem nenhuma garantia**, nem mesmo a garantia implícita de comerciabilidade ou adequação a um propósito específico.

**Por que GPL-3.0:** a grade de prática vai usar o [HyperFormula](https://hyperformula.handsontable.com/), que é distribuído sob GPL-3.0 (ou licença comercial). Para usá-lo sem licença comercial, o projeto passou de MIT para GPL-3.0-only. Novas dependências precisam ter licença compatível com a GPL-3.0.
