# Testes e2e (Playwright)

Fluxos críticos do MVP do Training Area, derivados dos critérios de aceite do backlog
(`TA-xxx ACn` no título) e das decisões do PO de 21/11/2026 (multi-tenant, login só
Google/Microsoft, importação .xlsx, feedback de IA com aprovação, conceitos ND/ED/D/PD,
Dashboard na v1.1). Cada teste que roda recebe a anotação `TC` com os IDs do plano de
testes final (`qa/test_cases.json` → `e2e/data/tc-index.json`). Para sincronizar com o QA
(plano de testes + 149 casos de fórmula em `qa/excel_formulas/`): `bash e2e/data/sync_qa_data.sh`
(copia `formulas.json`/`contexts.json` para `e2e/data/qa/` e roda `build_tc_index.py`).

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

| Variável                            | Padrão              | Para quê                                                               |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| `E2E_PORT`                          | `3100`              | porta do app em teste                                                  |
| `E2E_DB_NAME` / `E2E_DATABASE_URL`  | `training_area_e2e` | banco isolado da suíte                                                 |
| `E2E_SKIP_DB`                       | —                   | `1` pula criar/migrar/semear o banco                                   |
| `E2E_PASSWORD_LOGIN`                | `1`                 | `1` sobe o app com `AUTH_EMAIL_PASSWORD_ENABLED=true`; `0` sem ele     |
| `E2E_PASSWORD_HASH`                 | —                   | só se o schema não tiver a tabela `accounts` do Better Auth (fallback) |
| `E2E_OAUTH_PORT` / `E2E_OAUTH_MOCK` | `3199` / ligado     | provedor OAuth falso; `E2E_OAUTH_MOCK=0` desliga                       |

## Autenticação

- **Produção: só Google ou Microsoft.** Não há auto-cadastro nem `/cadastro`.
- **E-mail+senha é só dev/teste**: flag `AUTH_EMAIL_PASSWORD_ENABLED=true` (ignorada em
  produção; Backend 1). O cadastro público está desligado (`disableSignUp`), então a suíte
  **não** usa `signUpEmail`: o seed grava a senha como o seed do app — `hashPassword` de
  `better-auth/crypto` em uma conta `providerId: "credential"`, `accountId = user.id`. A suíte
  sobe o app com a flag ligada e o `auth.setup.ts` faz login por senha uma vez por sessão, salvando
  `e2e/.auth/<chave>.json` (chaves: `superadmin`, `admin`, `professor`, `aluno`, `aluno2`,
  `aluno-nd|ed|d|pd`, `admin-b`, `professor-b`, `aluno-b`).
- O teste "login por senha desligado" só roda com o app sem a flag:
  `E2E_PASSWORD_LOGIN=0 E2E_PORT=3101 npx playwright test -g "flag desligada"`.
- **OAuth mockado:** `support/mock-oauth.ts` sobe (no global-setup) um provedor falso em
  `http://localhost:3199` com `/google/authorize|token|userinfo` e `/microsoft/...` (mais
  discovery/jwks e `id_token` RS256). A suíte passa ao app `AUTH_OAUTH_MOCK_BASE_URL`
  (modo mock do Backend 1: registra google/microsoft via `genericOAuth`, callback
  `/api/auth/oauth2/callback/{google|microsoft}`), `GOOGLE_CLIENT_ID/SECRET` e
  `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` falsos (`support/env.ts`). O teste escolhe a conta —
  ou a negação de consentimento — com `loginPage.loginWithOAuth("google", email, { deny })`.

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

| Spec                           | Cobre                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`                | TA-032 (home com níveis do MVP, health); "home NÃO mostra Dashboard" é `test.fail` até o FE1 corrigir                                                                                                         |
| `security.spec.ts`             | TA-033 headers (**DevOps**)                                                                                                                                                                                   |
| `auth.spec.ts`                 | Google/Microsoft com OAuth mockado (sucesso, consentimento negado, conta não provisionada), sem auto-cadastro, login de teste por senha (ligado/desligado), TA-005, cookies                                   |
| `access-control.spec.ts`       | TA-003 por papel: anônimo, aluno, professor, Admin da instituição (403 em `/superadmin/*`), Super Admin                                                                                                       |
| **`tenant-isolation.spec.ts`** | **CRÍTICO**: inst-a × inst-b por UI, URL direta e API com IDs da outra instituição; 404 exato; URL/query/header não trocam tenant; e-mail único; Super Admin gere instituições mas NÃO vê respostas de alunos |
| `student-practice.spec.ts`     | TA-020–TA-025; subconjunto de `data/qa/formulas.json` (1 por código + valor fixo → "use uma fórmula"); `=A1*0+60` incorreto; vírgula decimal/pt-BR; conclusão ao enviar; testes ilimitados                    |
| `student-content.spec.ts`      | TA-011, TA-012                                                                                                                                                                                                |
| `teacher-authoring.spec.ts`    | TA-010, TA-013–TA-019 (só níveis do MVP)                                                                                                                                                                      |
| `teacher-import.spec.ts`       | importação .xlsx tudo-ou-nada: pré-visualização, erro por linha antes de confirmar, formato errado, corrompido, sem gabarito                                                                                  |
| `ai-feedback-review.spec.ts`   | feedback de IA: aluno vê `feedback-pending` até aprovar; rejeitado volta ao professor e o aluno segue em `feedback-pending`                                                                                   |
| `concepts-redo.spec.ts`        | conceitos ND/ED/D/PD (faixas provisórias); refazer só ND/ED: nova tentativa, histórico, vale o melhor                                                                                                         |
| `admin.spec.ts`                | TA-002 (último Admin por instituição, papel único), TA-006, TA-007, TA-008 (nome da instituição só no cabeçalho), Admin vê resultados só leitura                                                              |
| `teacher-results.spec.ts`      | TA-027–TA-030                                                                                                                                                                                                 |
| `dashboard-v11.spec.ts`        | Dashboard nunca aparece/é selecionável (trilha, conteúdo, conjunto, exercício, filtros); API recusa DASHBOARD                                                                                                 |

O nível **Dashboard** é v1.1: continua no enum `DASHBOARD` do schema, mas no MVP não aparece
nem é selecionável e a API recusa criar/editar conjunto, nível ou exercício com ele
(`dashboard-v11.spec.ts`, `support/levels.ts`).

### Decisões do PO refletidas nas asserções (21/11/2026)

- Recurso de outra instituição → **404** (não 403); o tenant vem da conta logada.
- Super Admin: instituições, Admins e conteúdo global; **não** vê respostas de alunos.
- Um papel por usuário; Admin da instituição vê resultados só para leitura.
- E-mail único na plataforma: convidar e-mail de outra instituição → erro claro (409).
- Feedback de IA rejeitado volta ao professor; o aluno continua vendo `feedback-pending`.
- Conceitos (provisório): % de corretos na tentativa — ND < 50, ED 50–69, D 70–89, PD ≥ 90.
- Refazer (ND/ED) cria nova tentativa com novo sorteio; histórico mantido; vale o melhor.
- Importação .xlsx tudo-ou-nada, com pré-visualização e erros por linha antes de confirmar.
- Quantidade por nível + dificuldade; publicação por conjunto.
- Exercício concluído ao enviar a resposta final (certa ou errada); testar fórmulas é ilimitado.
- Vírgula decimal e nomes pt-BR (SOMA, SES, SENÃODISP) aceitos; `forbidLiteralExpectedValue`
  ligado por padrão (`=A1*0+60` é incorreto).
- TA-008: login genérico; nome da instituição no cabeçalho depois do login (no login via URL é
  opcional e não é verificado).

## `test.fixme` = funcionalidade ainda não entregue

Testes de funcionalidades ainda não implementadas estão como `test.fixme(...)` (contam como
_skipped_). Ao entregar uma história, troque `test.fixme` por `test` nos testes dela e
ajuste seletores/rotas se o time divergir do contrato abaixo. Ordem natural para ligar:
`auth.setup.ts` (login de teste com `AUTH_EMAIL_PASSWORD_ENABLED`) → `access-control` →
`tenant-isolation` (com o schema de tenant) → demais.

## Contrato de UI esperado (com os frontends)

Rotas (acordadas com o Frontend Developer 2, em `support/routes.ts`):
`/login`, `/aluno`, `/aluno/exercicios/<slug>`, `/aluno/conteudo`, `/professor/resultados`,
`/professor/conjuntos`, `/professor/conteudo`, `/professor/revisao-feedback`,
`/professor/banco-exercicios` (importação .xlsx), `/admin/usuarios`, `/admin/configuracoes`
(Admin da instituição), `/superadmin/instituicoes` (Super Admin).
Aluno (confirmadas pelo Frontend 1): `/aluno`, `/aluno/conteudo`, `/aluno/exercicios/<slug>`,
`/aluno/niveis/<nivel>/feedback`. Ainda a acordar: `/professor/feedback` (faixas, TA-027) e
`/professor/resultados/alunos/<id>`.
Acesso negado por papel: status 403; recurso de outra instituição: **404**;
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
| `feedback-pending`                                       | aviso "feedback em revisão" do aluno (pendente/rejeitado)   |

## Importação .xlsx — modelo proposto

`data/xlsx/build_fixtures.py` gera os arquivos de teste (`exercicio-valido.xlsx`,
`exercicio-sem-gabarito.xlsx`, `exercicio-gabarito-linha-invalida.xlsx`,
`exercicio-corrompido.xlsx`, `exercicio-formato-errado.csv`)
no modelo proposto: aba **Dados** (Título, Nível, Dificuldade, Enunciado, Dica), aba
**Planilha** (grade inicial) e aba **Gabarito** (Célula | Resposta). Ajuste o script se o
Backend 2 definir outro modelo.
