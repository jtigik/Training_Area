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
npm run db:seed              # instituição demo, 1 usuário por papel e banco global de exercícios
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

Com `CI=1`, o Playwright usa o build de produção (rode `npm run build` antes). Porta padrão 3100 e banco isolado `training_area_e2e` (veja `e2e/README.md`); para usar outra porta: `E2E_PORT=3200 npm run test:e2e`. Para testar um servidor já rodando: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.

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

## Autenticação, papéis e multi-tenant

Login via [Better Auth](https://www.better-auth.com) (`src/server/auth/auth.ts`, rota `/api/auth/*`).

- **Lançamento:** Google e Microsoft. Cada provedor liga quando `GOOGLE_CLIENT_ID/SECRET` ou `MICROSOFT_CLIENT_ID/SECRET` estão no `.env` (veja `.env.example`; URIs de callback `${BETTER_AUTH_URL}/api/auth/callback/google|microsoft`).
- **OAuth mockado (E2E):** `AUTH_OAUTH_MOCK_BASE_URL`, veja abaixo.
- **E-mail e senha:** só para dev/teste, com `AUTH_EMAIL_PASSWORD_ENABLED=true` (ignorado em produção). Cadastro por e-mail fica desligado; as contas vêm do seed.
- **Primeiro login social:** o usuário entra na instituição de um convite pendente (`invitations`) ou, se a instituição tiver `autoJoinByDomain`, pelo domínio do e-mail (como Aluno). Sem vínculo, o login é recusado.
- `BETTER_AUTH_SECRET` é obrigatório (gere com `openssl rand -base64 32`); `BETTER_AUTH_URL` é a URL pública do app.

### OAuth mockado (E2E)

Com `AUTH_OAUTH_MOCK_BASE_URL` (ex.: `http://localhost:3199`) e fora de produção, Google e Microsoft são registrados pelo plugin `genericOAuth` do Better Auth com os mesmos ids, no lugar dos provedores nativos (nunca os dois ao mesmo tempo). O cliente não muda: `authClient.signIn.social({ provider: "google" | "microsoft" })` (no Better Auth 1.7 o genericOAuth usa o fluxo social; não existe `signIn.oauth2`). A lista de botões vem de `GET /api/login-options` (público) ou `getLoginOptions()` no servidor.

Contrato do provedor falso (para cada `{id}` em `google`, `microsoft`):

| Endpoint                    | O app envia                                                                                                       | O mock responde                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET {base}/{id}/authorize` | `response_type=code`, `client_id`, `redirect_uri`, `state`, `scope=openid email profile`, `code_challenge` (S256) | `302` para `redirect_uri?code=…&state=…` (mesmo `state`)                                             |
| `POST {base}/{id}/token`    | form: `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`, `client_id`, `client_secret`      | JSON `{ "access_token", "token_type": "Bearer", "expires_in" }` (sem `id_token`)                     |
| `GET {base}/{id}/userinfo`  | `Authorization: Bearer <access_token>`                                                                            | JSON `{ "sub", "email", "email_verified": true, "name", "picture" }` (`id` aceito no lugar de `sub`) |

Callback: `${BETTER_AUTH_URL}/api/auth/callback/{id}`. As regras de vínculo valem igual: e-mail de usuário existente (ex.: seed) é vinculado à conta (provedores confiáveis); e-mail novo precisa de convite pendente ou domínio da instituição com `autoJoinByDomain`; sem vínculo o callback **redireciona** para `/login?error=ACCOUNT_NOT_REGISTERED` (mensagem: "Sua conta não está cadastrada nesta instituição. Fale com seu professor ou administrador."). Outros erros do callback (provedor negou, state expirado, conta desativada `ACCOUNT_DISABLED`) também voltam para `/login?error=<código>` (`onAPIError.errorURL`). A tela usa `authErrorMessage(code)` de `src/lib/auth-errors.ts`; chamadas JSON em `/api/*` continuam 401/403.

**Papéis:** `SUPER_ADMIN` (plataforma, sem instituição), `INSTITUTION_ADMIN`, `PROFESSOR`, `ALUNO`.

Cada área é exclusiva de um papel (sem "prévia do aluno" para PROFESSOR no MVP):

| Rota                                                  | Acesso                         |
| ----------------------------------------------------- | ------------------------------ |
| `/super-admin`, `/api/super-admin`                    | SUPER_ADMIN                    |
| `/api/admin/grading-config`, `/api/admin/invitations` | INSTITUTION_ADMIN, SUPER_ADMIN |
| `/admin`, `/api/admin` (demais)                       | INSTITUTION_ADMIN              |
| `/professor`, `/api/professor`                        | PROFESSOR                      |
| `/aluno`, `/api/aluno`                                | ALUNO                          |
| `/api/me`                                             | qualquer sessão                |

As regras ficam em `src/lib/authz/route-rules.ts` e são aplicadas por `src/proxy.ts`: página sem sessão → `/login?callbackUrl=…`; API sem sessão → 401 `UNAUTHENTICATED`; **página de outra área → redireciona para a home do próprio papel** (ALUNO → `/aluno`, PROFESSOR → `/professor`, INSTITUTION_ADMIN → `/admin`, SUPER_ADMIN → `/super-admin`); **API de outra área → 403 `FORBIDDEN`** no envelope padrão. Nível fora do MVP em `/aluno/niveis/:nivel` → 404. **A proxy não basta:** todo route handler e server action deve chamar:

```ts
import { requireTenant } from "@/server/auth/tenant";
const { tenantId, user } = await requireTenant(["PROFESSOR"]);
await prisma.exerciseSet.findMany({ where: { tenantId } }); // sempre filtre pelo tenant
```

`requireTenant` usa o `tenantId` da sessão; só o SUPER_ADMIN atravessa instituições e precisa informar `requestedTenantId`. Também existem `requireSession`/`requireRole` (`src/server/auth/session.ts`). Feedback para o aluno: use `listApprovedFeedbackForStudent` (`src/server/feedback/student.ts`), que só devolve feedback `APPROVED`.

#### Formato de erro das APIs

Todas as rotas `/api/*` do app (exceto `/api/auth/*`, que é do Better Auth) respondem erros como:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [{ "path": "email", "message": "E-mail inválido" }]
  }
}
```

- `code` é estável (decida por ele no front); `message` vem pronta em pt-BR; `details` é opcional.
- Códigos genéricos: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `SCOPE_DENIED` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400), `CONFLICT` (409); serviços usam códigos próprios (`LAST_ADMIN`, `EMAIL_IN_USE`, `LEVEL_LOCKED`...).
- Helpers em `src/lib/api-error.ts`: `ApiError` (lance nos serviços), `apiError()`, `validationError(zodIssues)`, `isApiErrorBody()` (cliente). Nas rotas: `try { ... } catch (e) { return handleApiError(e) }` (`src/server/api-response.ts`).

### Sessão no cliente e `/api/me`

- `GET /api/me` → `{ user: { id, name, email, role, tenantId, tenant: { id, name, slug } | null } }` (401 sem sessão).
- `GET /api/auth/get-session` / `authClient.useSession()` → `{ user: { ...campos do Better Auth, role, tenantId, active, tenant }, session }` (ou `null`), via plugin `customSession` + `customSessionClient`.
- `tenant` é `null` só para SUPER_ADMIN. O resumo fica em cache por 60 s por processo
  (`src/server/auth/tenant-summary.ts`); chame `invalidateTenantSummary(id)` ao renomear.

## Desbloqueio de níveis (por conjunto)

Ordem: **Fundamental → Profissional → Avançado** (`DASHBOARD` é ignorado no MVP).
Regra pura em `src/lib/level-unlock.ts` (`computeLevelUnlocks`), aplicada em
`POST /api/aluno/levels/{id}/attempts` (`src/server/levels/start.ts`):

- o primeiro nível existente do conjunto está sempre aberto;
- o próximo abre quando a **última tentativa concluída** do anterior teve conceito **D ou PD**;
- ND/ED permitem refazer o mesmo nível (nova `attemptNumber`); D/PD encerram o nível;
- erros 409: `LEVEL_LOCKED`, `LEVEL_IN_PROGRESS`, `LEVEL_AWAITING_GRADE`, `LEVEL_ALREADY_PASSED`,
  `LEVEL_NOT_AVAILABLE` (DASHBOARD), `EMPTY_POOL`;
- ao iniciar, a cota (aluno > turma > padrão do nível; senão 10) define quantos exercícios são
  sorteados e congelados em `LevelAttemptExercise`. A resposta traz só os campos de aluno
  (sem `expectedResult`/`gradingRules`).

`GET /api/aluno/sets/{id}/progress` devolve `{ levels: LevelUnlockState[] }` para a trilha.

## SUPER_ADMIN: só números agregados

Decisão do PO: o SUPER_ADMIN administra a plataforma, mas **nunca** vê registros individuais
dentro das instituições (alunos, tentativas, textos de feedback, PII).

- `requireTenant()` dá ao SUPER_ADMIN `ctx.access = "platform"`: `ctx.db` só permite
  `TenantGradingConfig` (faixas), ler o próprio `Tenant` e criar `Invitation`. Qualquer outro
  acesso (inclusive `count`) lança `TenantScopeError` → `403 SCOPE_DENIED`.
- Rotas exclusivas (`/api/super-admin/*`, só SUPER_ADMIN):
  - `GET /api/super-admin/metrics` → `{ generatedAt, totals, tenants: [{ tenant: { id, name, slug, active }, users: { INSTITUTION_ADMIN, PROFESSOR, ALUNO, total }, levelAttempts: { total, inProgress, completed, abandoned }, concepts: { ND, ED, D, PD } }] }` (só `groupBy`).
  - `GET|POST /api/super-admin/tenants`, `PATCH /api/super-admin/tenants/:id` (`name`, `slug`, `emailDomains`, `autoJoinByDomain` — padrão `false`, `locale`, `active`). `409 SLUG_IN_USE`.
  - `GET|POST /api/super-admin/exercises`, `PATCH /api/super-admin/exercises/:id`: banco **global** de exercícios.
- Também pode: `POST /api/admin/invitations` com `tenantId` (convidar o primeiro INSTITUTION_ADMIN de uma instituição). Não pode: faixas de uma instituição (só o ADMIN, em `/api/admin/grading-config`), trocar papel de usuários, rotas de professor/aluno.
- Faixas padrão da plataforma: `GET|PUT /api/super-admin/grading-defaults` `{ edMinPercent, dMinPercent, pdMinPercent }` (padrão 50/70/90). Valem só para instituições **novas**: `POST /api/super-admin/tenants` copia o padrão para `TenantGradingConfig`; as existentes não mudam. Regra do PO `0 < ND < ED < D ≤ 100` = `0 < edMinPercent < dMinPercent < pdMinPercent ≤ 100` (limites ND→ED, ED→D, D→PD); inválido → 422 `VALIDATION_ERROR`.

## Isolamento por tenant (`forTenant`)

Todo código de servidor que lê/grava dados de instituição usa o cliente com escopo
(`src/server/tenant-db.ts`, regras em `src/server/tenant-scope.ts`):

```ts
const { db, user } = await requireTenant(["PROFESSOR"]); // ctx.db = forTenant(ctx.tenantId)
await db.levelAttempt.findMany({ where: { status: "COMPLETED" } }); // tenantId injetado
await db.exercise.findMany(); // exercícios do tenant + globais (tenantId nulo)
```

- Modelos de tenant: `where` recebe `AND: [{ tenantId }]` em leituras/updates/deletes
  (inclusive `findUnique`); `create`/`createMany`/`upsert` recebem `tenantId`; outro
  `tenantId` ou trocar de tenant ⇒ `TenantScopeError`.
- `Exercise`/`ContentSection`: leitura `tenantId = X OU nulo`; escrita só do tenant
  (`isGlobal` forçado a `false`). Globais só pelo cliente base (SUPER_ADMIN/seed).
- `Tenant`: só o próprio, leitura. `Session`/`Account`/`Verification`: bloqueados.
- Vale em `$transaction` interativa. **Não** reescreve relações aninhadas
  (`include`, nested writes) nem `$queryRaw` — consulte o filho pelo `db`.
- Cliente base (`prisma`) só em: Better Auth e seus hooks de provisionamento, seed,
  operações de plataforma e verificações globais (e-mail único).
- Testes: `npm test` (regras puras) e `npm run test:db` (Postgres real, `.env` carregado).

## Contas de desenvolvimento (seed)

Senhas **apenas para dev** (sobrescreva com `SEED_*_PASSWORD`; em produção o seed exige as variáveis). Login por senha exige `AUTH_EMAIL_PASSWORD_ENABLED=true`.

| Papel             | E-mail                        | Senha               | Instituição |
| ----------------- | ----------------------------- | ------------------- | ----------- |
| SUPER_ADMIN       | `admin@training-area.local`   | `SuperAdmin@Dev123` | —           |
| INSTITUTION_ADMIN | `admin@escola-demo.local`     | `Admin@Dev123`      | Escola Demo |
| PROFESSOR         | `professor@escola-demo.local` | `Professor@Dev123`  | Escola Demo |
| ALUNO             | `aluno@escola-demo.local`     | `Aluno@Dev123`      | Escola Demo |

O seed também cria 5 exercícios e 1 seção de conteúdo **globais** e a "Trilha Demo" (nível Fundamental, cota padrão 3) na Escola Demo.

## Modelo de dados

`prisma/schema.prisma` (comentado). Resumo:

- **Tenant** (instituição). Toda entidade de domínio tem `tenantId`, indexado, e unicidades escopadas por tenant.
- **User / Session / Account / Verification**: tabelas do Better Auth. `users.tenant_id` é nulo só para SUPER_ADMIN (CHECK). **Invitation**: convite com papel. **E-mail é único na plataforma** (uma pessoa, uma instituição): `users.email` UNIQUE e minúsculo, no máximo um convite pendente por e-mail em todas as instituições; `POST /api/admin/invitations` recusa (409) e-mail com conta ou com convite pendente em outra instituição.
- **Classroom / ClassroomMember**: turmas.
- **Níveis (`KnowledgeLevel`)**: `FUNDAMENTAL`, `PROFESSIONAL`, `ADVANCED` e `DASHBOARD` (reservado para v1.1). No MVP a validação (`src/lib/validation/content.ts`) recusa DASHBOARD e a UI deve usar `SELECTABLE_LEVEL_OPTIONS` (`src/lib/domain.ts`).
- **ContentSection / Exercise**: `tenantId` nulo + `isGlobal = true` = **global** (banco inicial da plataforma): toda instituição lê, só o SUPER_ADMIN escreve. Com tenant = exclusivo da instituição.
- **ExerciseSet → Level → ExerciseQuota**: trilha da instituição, níveis participantes e quantidade (padrão, por turma ou por aluno; precedência em `src/lib/quota.ts`). O pool de um Level são os exercícios publicados do mesmo nível, nas dificuldades do conjunto, da instituição **ou globais**.
- **LevelAttempt**: tentativa do aluno num nível. Ao concluir, `computedConcept` é calculado pela taxa de acerto com as faixas da instituição (**TenantGradingConfig**: ND < `edMinPercent` (50) ≤ ED < `dMinPercent` (70) ≤ D < `pdMinPercent` (90) ≤ PD; sem linha = padrão; snapshot em `gradingBands`). O professor pode ajustar o conceito final (`concept`) com justificativa obrigatória (≥ 10 caracteres): `overriddenById`, `overrideReason`, `overriddenAt` e uma linha imutável em **ConceptOverride**. Refazer só após conceito final ND/ED (`src/lib/grading.ts`). APIs: `PATCH /api/professor/level-attempts/:id/concept`, `GET|PUT /api/admin/grading-config`. **ExerciseAttempt**: cada envio, ligado à LevelAttempt.
- **Feedback** (1:1 com LevelAttempt): gerado por IA (`aiText`), revisado pelo professor (`editedText`, `reviewedById`, `reviewedAt`), status `DRAFT | APPROVED | REJECTED`.

Restrições que o Prisma não modela (CHECKs) estão no SQL da migração `*_multitenant_auth_core_model`.

**Pool do nível (MVP):** um Level sorteia exercícios PUBLICADOS do tenant + globais com o
mesmo `knowledgeLevel` e uma das `difficulties` do ExerciseSet, até a cota resolvida por
`resolveQuota` (aluno > turma > padrão). Sem exercícios fixos (v1.1). Helpers:
`levelPoolWhere`/`drawFromPool` (`src/lib/pool.ts`) e `listLevelPool(db, levelId)`.

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

| Variável                                              | Obrigatória?                           | Para que serve                                                                                                      | Valor na CI                                                                 |
| ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Só para o Compose                      | Credenciais do container PostgreSQL                                                                                 | `training` / `training` / `training_area` (service do job e2e)              |
| `POSTGRES_PORT`                                       | Não (padrão `5432`)                    | Porta do Postgres no host                                                                                           | —                                                                           |
| `DATABASE_URL`                                        | Sim, para banco, migrações e seed      | Conexão do Prisma                                                                                                   | `postgresql://training:training@localhost:5432/training_area?schema=public` |
| `APP_PORT`                                            | Não (padrão `3000`)                    | Porta do app no perfil `app` do Compose                                                                             | —                                                                           |
| `BETTER_AUTH_SECRET`                                  | **Sim em produção**                    | Chave do Better Auth para assinar cookies/tokens (`openssl rand -base64 32`; `AUTH_SECRET` aceito como alternativa) | secret `BETTER_AUTH_SECRET` ou valor fictício                               |
| `BETTER_AUTH_URL`                                     | Recomendado em produção                | URL pública do app, base dos callbacks OAuth                                                                        | `http://localhost:3000`                                                     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`           | Não (sempre em par)                    | OAuth Google. Callback: `<BETTER_AUTH_URL>/api/auth/callback/google`                                                | secrets ou valores fictícios                                                |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`     | Não (sempre em par)                    | OAuth Microsoft (Entra ID). Callback: `<BETTER_AUTH_URL>/api/auth/callback/microsoft`                               | secrets ou valores fictícios                                                |
| `MICROSOFT_TENANT_ID`                                 | Não (padrão `common`)                  | Diretório do Entra ID: `common`, `organizations` ou o ID do diretório                                               | `common`                                                                    |
| `AUTH_OAUTH_MOCK_BASE_URL`                            | Não (só dev/teste)                     | Provedor OAuth falso para E2E (genericOAuth); ignorado em produção                                                  | —                                                                           |
| `AUTH_EMAIL_PASSWORD_ENABLED`                         | Não (padrão `false`)                   | Login por e-mail e senha só em dev/teste (seed/E2E); ignorado em produção                                           | —                                                                           |
| `AI_PROVIDER`                                         | Não (padrão `disabled`)                | Provedor de IA do feedback: `disabled` (sem IA), `mock` (texto fixo local) ou `openai-compatible`                   | `mock`                                                                      |
| `AI_API_KEY`                                          | Sim se `AI_PROVIDER=openai-compatible` | Chave da API compatível com OpenAI                                                                                  | vazio                                                                       |
| `AI_BASE_URL`                                         | Sim se `AI_PROVIDER=openai-compatible` | URL base da API (ex.: `https://api.openai.com/v1`)                                                                  | vazio                                                                       |
| `AI_TIMEOUT_MS`                                       | Não                                    | Timeout das chamadas de IA (ms)                                                                                     | `30000`                                                                     |
| `AI_MODEL`                                            | Não                                    | Modelo do provedor (vazio = padrão definido no código)                                                              | vazio                                                                       |
| `TENANT_RESOLUTION`                                   | Não (padrão `single`)                  | Como o tenant é identificado: `single`, `path` (`/t/<slug>/...`) ou `subdomain`                                     | `single`                                                                    |
| `DEFAULT_TENANT_SLUG`                                 | Não (padrão `default`)                 | Tenant usado em `single` e como fallback                                                                            | `default`                                                                   |
| `APP_ROOT_DOMAIN`                                     | Sim se `TENANT_RESOLUTION=subdomain`   | Domínio raiz dos subdomínios (ex.: `training.example.com`)                                                          | vazio                                                                       |

Notas:

- A autenticação usa **Better Auth** (TA-001); os nomes acima são os lidos por `src/server/auth/config.ts` e validados por `src/lib/env.ts`.
- Na CI, as variáveis de OAuth usam os secrets do repositório se existirem; se não existirem, usam valores fictícios. Nenhum teste chama Google, Microsoft ou provedor de IA.
- No Compose, o serviço `app` lê o `.env` (`env_file`) e sobrescreve só a `DATABASE_URL`.

## Multi-tenant (impacto na infra)

> **Confirmado pelo backend:** banco **compartilhado**, coluna `tenant_id` nas tabelas de domínio, modelo `Tenant` no schema e isolamento centralizado em `forTenant` (veja "Isolamento por tenant"). O tenant da requisição vem da **sessão** (`users.tenant_id`); `TENANT_RESOLUTION` ficam reservadas para resolução por URL e não participam da autorização.

- **Banco:** uma única instância PostgreSQL e um único schema. O isolamento é lógico (`tenant_id` + filtros na camada de dados; Row-Level Security do Postgres pode ser avaliada depois). Migrações continuam únicas para todos os tenants.
- **Resolução do tenant:** `TENANT_RESOLUTION=single` (dev/piloto: sempre `DEFAULT_TENANT_SLUG`), `path` (`/t/<slug>/...`, não exige DNS) ou `subdomain` (`<slug>.<APP_ROOT_DOMAIN>`).
- **Subdomínios em produção:** exigem DNS curinga (`*.APP_ROOT_DOMAIN`), certificado TLS curinga e proxy/ingress que preserve o header `Host`.
- **OAuth com subdomínios:** os redirect URIs do Google e do Entra ID não aceitam curinga. Use um host fixo de autenticação (`BETTER_AUTH_URL`) e redirecione ao tenant depois do login.
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
