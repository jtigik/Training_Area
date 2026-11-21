# Testes e2e (Playwright)

Fluxos críticos do MVP do Training Area, derivados dos critérios de aceite do backlog
(`TA-xxx ACn` no título de cada teste). Quando o plano de testes do QA
(`qa/TEST_CASES.md`) for publicado, os IDs `TC-*` serão adicionados aos títulos.

## Como rodar

```bash
cp ../repo/.env .env                 # se ainda não existir (DATABASE_URL do Postgres de dev, porta 5433)
npm ci
npx playwright install chromium      # 1ª vez (ou npm run test:e2e:install, que instala deps do sistema)
npm run test:e2e                     # sobe `next dev -p 3100` e roda a suíte
E2E_PORT=3200 npm run test:e2e       # outra porta
E2E_BASE_URL=http://localhost:3100 npm run test:e2e   # servidor já rodando (pula o banco)
npx playwright test e2e/specs/access-control.spec.ts # um arquivo
npm run test:e2e:ui                  # modo UI
```

Porta padrão: **3100** (a 3000 é usada pelo `next dev` de outros worktrees).

## Banco de dados isolado

A suíte **nunca** usa nem apaga o banco de dev compartilhado (`training_area`).
O `global-setup.ts`:

1. cria, se não existir, o banco `training_area_e2e` no mesmo servidor do `DATABASE_URL`
   (troque com `E2E_DB_NAME` ou passe a URL inteira em `E2E_DATABASE_URL`);
2. roda `prisma migrate deploy` nele;
3. faz upsert (sem apagar nada) dos usuários de teste:
   `e2e.aluno@`, `e2e.aluno2@`, `e2e.professor@`, `e2e.admin@training-area.test`;
4. sobe o app (webServer) com `DATABASE_URL` apontando para esse banco.

Todo dado criado pelos testes usa o prefixo `e2e` (e-mails `e2e.*@training-area.test`,
títulos `e2e <timestamp> ...`). Para recomeçar do zero, apague só o banco da suíte:
`dropdb -h localhost -p 5433 -U training training_area_e2e`.
`E2E_SKIP_DB=1` pula o provisionamento.

## Estrutura

```
e2e/
├── auth.setup.ts        # projeto "setup": login por papel → e2e/.auth/<papel>.json (storage state)
├── global-setup.ts      # banco isolado + usuários de teste
├── fixtures.ts          # test estendido com page objects; asRole("aluno"|"professor"|"admin"), asAnonymous()
├── pages/               # page objects (login, shell, aluno, professor, admin)
├── support/             # env, usuários, mapa de rotas/APIs
├── data/formulas.json   # dataset de fórmulas (corretas, equivalentes, inválidas, não suportadas, borda)
└── specs/               # specs por área
```

| Spec                        | Histórias                                                              |
| --------------------------- | ---------------------------------------------------------------------- |
| `smoke.spec.ts`             | TA-032 (home, health)                                                  |
| `security.spec.ts`          | TA-033 (headers)                                                       |
| `auth.spec.ts`              | TA-001, TA-005, TA-007 AC3, TA-033 AC3 (cookies)                       |
| `access-control.spec.ts`    | TA-003 (URL direta e API por papel), negativos de TA-002/TA-010/TA-029 |
| `student-practice.spec.ts`  | TA-020, TA-021, TA-022, TA-024, TA-025, TA-026                         |
| `student-content.spec.ts`   | TA-011, TA-012                                                         |
| `teacher-authoring.spec.ts` | TA-010, TA-013–TA-019                                                  |
| `teacher-results.spec.ts`   | TA-027–TA-030                                                          |
| `admin.spec.ts`             | TA-002, TA-006, TA-007, TA-008                                         |

## `test.fixme` = funcionalidade ainda não entregue

Testes de histórias ainda não implementadas estão como `test.fixme(...)` (contam como
_skipped_). Ao entregar uma história, troque `test.fixme` por `test` nos testes daquela
história e ajuste seletores/rotas se o time divergir do contrato abaixo. O login
(`auth.setup.ts`) é o primeiro a ligar: depende de TA-001 **e** de gravar
`password_hash` no seed da suíte (TODO em `global-setup.ts`).

## Contrato de UI esperado (seletores)

Seletores por papel/rótulo acessível seguem os wireframes em `design/wireframes`.
Onde não há rótulo estável, a suíte espera estes `data-testid`:

| data-testid                   | Onde                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `cell-<REF>` (ex.: `cell-A4`) | cada célula da grade (aluno, pré-visualização e autoria) |
| `answer-cell-<REF>`           | campo de gabarito na autoria do exercício                |
| `exercise-item`               | item de exercício na trilha do aluno                     |
| `exercise-hint`               | dica exibida após resposta incorreta                     |
| `content-section-item`        | item de seção na leitura do aluno                        |
| `section-item`                | item de seção no CMS do professor                        |
| `feedback-band-<n>`           | linha de faixa de feedback do professor                  |

Rotas esperadas (em `support/routes.ts`): `/login`, `/cadastro`, `/aluno`,
`/aluno/exercicios/<slug>`, `/aluno/conteudo`, `/professor/resultados`,
`/professor/conjuntos`, `/professor/conteudo`, `/professor/feedback`, `/admin/usuarios`,
`/admin/configuracoes`; APIs conforme `.fe2-draft/src/lib/services/contracts.ts`.
Acesso negado: página com status 403; anônimo: redireciona para `/login?voltar=<rota>`.
