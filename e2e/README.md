# Testes e2e (Playwright)

Fluxos críticos do MVP do Training Area, derivados dos critérios de aceite do backlog
(`TA-xxx ACn` no título) e das decisões do PO de 21/11/2026 (multi-tenant, login só
Google/Microsoft, importação .xlsx, feedback de IA com aprovação, conceitos ND/ED/D/PD,
Dashboard na v1.1). Cada teste que roda recebe a anotação `TC` com os IDs do plano de
testes (`qa/test_cases.json` → `e2e/data/tc-index.json`; regerar com
`python3 e2e/data/build_tc_index.py ../qa/test_cases.json`).

## Como rodar

```bash
cp ../repo/.env .env                 # se ainda não existir (DATABASE_URL do Postgres de dev, porta 5433)
npm ci
npx playwright install chromium      # 1ª vez (ou npm run test:e2e:install, que instala deps do sistema)
npm run test:e2e                     # sobe `next dev -p 3100` e roda a suíte
E2E_PORT=3200 npm run test:e2e       # outra porta
E2E_BASE_URL=http://localhost:3100 npm run test:e2e   # servidor já rodando (pula banco e mock OAuth)
npx playwright test e2e/specs/tenant-isolation.spec.ts # um arquivo
npm run test:e2e:ui                  # modo UI
```

Porta padrão: **3100** (a 3000 é usada pelo `next dev` de outros worktrees).

| Variável                            | Padrão                | Para quê                                                                       |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| `E2E_PORT`                          | `3100`                | porta do app em teste                                                          |
| `E2E_DB_NAME` / `E2E_DATABASE_URL`  | `training_area_e2e`   | banco isolado da suíte                                                         |
| `E2E_SKIP_DB`                       | —                     | `1` pula criar/migrar/semear o banco                                           |
| `E2E_PASSWORD_LOGIN`                | `1`                   | liga o login de teste por senha no app; `0` sobe o app sem ele                 |
| `E2E_PASSWORD_FLAG_VAR`             | `AUTH_PASSWORD_LOGIN` | nome da flag do app (a confirmar com o Backend 1)                              |
| `E2E_PASSWORD_HASH`                 | —                     | hash de `E2E_PASSWORD` gravado no seed (até o seed poder chamar o hash do app) |
| `E2E_OAUTH_PORT` / `E2E_OAUTH_MOCK` | `3199` / ligado       | provedor OAuth falso; `E2E_OAUTH_MOCK=0` desliga                               |

## Autenticação

- **Produção: só Google ou Microsoft.** Não há auto-cadastro nem `/cadastro`.
- **E-mail+senha é só dev/teste**, desligado por padrão (Backend 1). A suíte sobe o app com a
  flag ligada e o `auth.setup.ts` faz login por senha uma vez por sessão, salvando
  `e2e/.auth/<chave>.json` (chaves: `superadmin`, `admin`, `professor`, `aluno`, `aluno2`,
  `aluno-nd|ed|d|pd`, `admin-b`, `professor-b`, `aluno-b`).
- O teste "login por senha desligado" só roda com o app sem a flag:
  `E2E_PASSWORD_LOGIN=0 E2E_PORT=3101 npx playwright test -g "flag desligada"`.
- **OAuth mockado:** `support/mock-oauth.ts` sobe (no global-setup) um provedor OIDC falso em
  `http://localhost:3199/google` e `/microsoft` (discovery, authorize, token com `id_token`
  RS256, userinfo, jwks). O teste escolhe a conta — ou a negação de consentimento — com
  `loginPage.loginWithOAuth("google", email, { deny })`. **Contrato pedido ao Backend 1:** o
  app deve ler o issuer/credenciais de env; a suíte passa `AUTH_GOOGLE_ISSUER`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`,
  `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET` (ajuste em `support/env.ts`).

## Banco e seed próprios (multi-tenant)

A suíte **nunca** usa nem apaga o banco de dev compartilhado (`training_area`) e **não depende
do seed do app**. O `global-setup.ts` cria `training_area_e2e` (se faltar), roda
`prisma migrate deploy` e executa `e2e/seed.ts` (upsert, sem apagar dados):

| Instituição               | Usuários (e-mail `@training-area.test`)                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| — (global, tenantId nulo) | `e2e.superadmin` (Super Admin)                                                                             |
| `e2e-inst-a`              | `e2e.a.admin` (único Admin), `e2e.a.professor`, `e2e.a.aluno`, `e2e.a.aluno2`, `e2e.a.aluno-nd/-ed/-d/-pd` |
| `e2e-inst-b`              | `e2e.b.admin` (único Admin), `e2e.b.professor`, `e2e.b.aluno`                                              |

O seed lê o `information_schema` e grava só o que o schema atual suporta: hoje (main) cria os
usuários sem instituição e pula o Super Admin; quando o schema de `feat/auth-modelo` chegar,
grava instituições, `tenant_id` e `SUPER_ADMIN` sem mudar `support/users.ts` (nomes
candidatos em `SCHEMA_CANDIDATES`). Os dados de domínio (conjuntos, exercícios, tentativas,
conceitos, feedback de IA, recursos da inst-b com IDs fixos em `TENANT_RESOURCES`) estão
marcados como TODO no seed. Para recomeçar: `dropdb -h localhost -p 5433 -U training training_area_e2e`.

## Estrutura

```
e2e/
├── auth.setup.ts        # projeto "setup": login de teste por sessão → e2e/.auth/<chave>.json
├── global-setup.ts      # banco isolado + seed + mock OAuth
├── seed.ts              # seed próprio, adaptável ao schema
├── fixtures.ts          # page objects; asRole(<chave>), asAnonymous(); anotação TC automática
├── pages/               # page objects (login, shell, aluno, professor, admin, super admin)
├── support/             # env, usuários/instituições, níveis, rotas/APIs, mock OAuth
├── data/                # formulas.json, tc-index.json, xlsx/ (arquivos de importação)
└── specs/
```

| Spec                           | Cobre                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`                | TA-032 (home com níveis do MVP, health)                                                                                                                                     |
| `security.spec.ts`             | TA-033 headers (**DevOps**)                                                                                                                                                 |
| `auth.spec.ts`                 | Google/Microsoft com OAuth mockado (sucesso, consentimento negado, conta não provisionada), sem auto-cadastro, login de teste por senha (ligado/desligado), TA-005, cookies |
| `access-control.spec.ts`       | TA-003 por papel: anônimo, aluno, professor, Admin da instituição (403 em `/superadmin/*`), Super Admin                                                                     |
| **`tenant-isolation.spec.ts`** | **CRÍTICO**: inst-a × inst-b por UI, URL direta e API com IDs da outra instituição; Admin limitado ao tenant; Super Admin vê todas                                          |
| `student-practice.spec.ts`     | TA-020–TA-025; fórmulas de `data/formulas.json`, incluindo valor fixo → "use uma fórmula"                                                                                   |
| `student-content.spec.ts`      | TA-011, TA-012                                                                                                                                                              |
| `teacher-authoring.spec.ts`    | TA-010, TA-013–TA-019 (só níveis do MVP)                                                                                                                                    |
| `teacher-import.spec.ts`       | importação .xlsx: válido, formato errado, corrompido, sem gabarito, permissão                                                                                               |
| `ai-feedback-review.spec.ts`   | feedback de IA: pendente invisível ao aluno, professor edita/aprova/rejeita                                                                                                 |
| `concepts-redo.spec.ts`        | conceitos ND/ED/D/PD; refazer só ND/ED (UI e API)                                                                                                                           |
| `teacher-results.spec.ts`      | TA-027–TA-030                                                                                                                                                               |
| `admin.spec.ts`                | TA-002 (último Admin **por instituição**), TA-006, TA-007, TA-008                                                                                                           |

O nível **Dashboard** foi para a v1.1: nenhum teste do MVP o usa (`support/levels.ts`).

## `test.fixme` = funcionalidade ainda não entregue

Testes de funcionalidades ainda não implementadas estão como `test.fixme(...)` (contam como
_skipped_). Ao entregar uma história, troque `test.fixme` por `test` nos testes dela e
ajuste seletores/rotas se o time divergir do contrato abaixo. Ordem natural para ligar:
`auth.setup.ts` (login de teste + `E2E_PASSWORD_HASH`) → `access-control` →
`tenant-isolation` (com o schema de tenant) → demais.

## Contrato de UI esperado (com os frontends)

Rotas (acordadas com o Frontend Developer 2, em `support/routes.ts`):
`/login`, `/aluno`, `/aluno/exercicios/<slug>`, `/aluno/conteudo`, `/professor/resultados`,
`/professor/conjuntos`, `/professor/conteudo`, `/professor/revisao-feedback`,
`/professor/banco-exercicios` (importação .xlsx), `/admin/usuarios`, `/admin/configuracoes`
(Admin da instituição), `/superadmin/instituicoes` (Super Admin).
Ainda a acordar: `/professor/feedback` (faixas de feedback, TA-027) e as rotas internas
(`/aluno/niveis/<nivel>/feedback`, `/professor/resultados/alunos/<id>`).
Acesso negado: página com status 403; recurso de outra instituição: 404 (403 aceito);
anônimo: redireciona para `/login?voltar=<rota>`.

| data-testid                                              | Onde                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `cell-<REF>` (ex.: `cell-A4`)                            | cada célula da grade (aluno, pré-visualização e autoria)    |
| `answer-cell-<REF>`                                      | campo de gabarito na autoria do exercício                   |
| `exercise-item`                                          | item de exercício (trilha do aluno, banco de exercícios)    |
| `exercise-hint`                                          | dica exibida após resposta incorreta                        |
| `content-section-item`                                   | item de seção na leitura do aluno                           |
| `section-item`                                           | item de seção no CMS do professor                           |
| `feedback-band-<n>`                                      | linha de faixa de feedback do professor                     |
| `institution-item`                                       | instituição na lista do Super Admin                         |
| `review-feedback-item`                                   | item da fila de revisão de feedback de IA                   |
| `feedback-approve` / `feedback-reject` / `feedback-edit` | ações em um item da fila                                    |
| `xlsx-import-input`                                      | `<input type="file">` da importação .xlsx                   |
| `import-result`                                          | resumo/erro da importação                                   |
| `concept-badge`                                          | conceito do nível, texto exatamente `ND`, `ED`, `D` ou `PD` |
| `redo-button`                                            | botão "Refazer" do nível (só existe para ND/ED)             |

## Importação .xlsx — modelo proposto

`data/xlsx/build_fixtures.py` gera os arquivos de teste (`exercicio-valido.xlsx`,
`exercicio-sem-gabarito.xlsx`, `exercicio-corrompido.xlsx`, `exercicio-formato-errado.csv`)
no modelo proposto: aba **Dados** (Título, Nível, Dificuldade, Enunciado, Dica), aba
**Planilha** (grade inicial) e aba **Gabarito** (Célula | Resposta). Ajuste o script se o
Backend 2 definir outro modelo.
