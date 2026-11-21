# Motor de correção de fórmulas (`src/server/grading`)

Serviço puro em TypeScript que corrige a resposta do aluno para um exercício de Excel usando
[HyperFormula](https://hyperformula.handsontable.com/). Não depende de banco, Prisma nem Next.js.

> **Licença:** HyperFormula é **GPL-3.0** (ou licença comercial da Handsoncode). Usamos a chave
> `'gpl-v3'` (`config.ts`) por enquanto. O repositório é MIT: **é preciso decidir antes do lançamento**
> se o projeto aceita a GPL-3.0 (ou relicencia) ou se compra a licença comercial.

## Uso

```ts
import { gradeSubmission, toStudentResult, validateExercise } from "@/server/grading";

const exercise = {
  sheet: [[10], [20], [30]], // ou { A1: 10, A2: 20, A3: 30 }
  targetCell: "A4",
  expected: { formula: "=SUM(A1:A3)" }, // ou { value: 60 } / { value: { date: "2026-11-21" } }
  requiredFunctions: ["SOMA"], // opcional; aceita nomes pt-BR ou inglês
};

validateExercise(exercise); // ao salvar/publicar (TA-016, TA-034)
const result = gradeSubmission(exercise, "=SOMA(A1;A2;A3)"); // { correct: true, feedbackCode: "CORRECT", ... }
return toStudentResult(result); // nunca envie expectedValue ao aluno (TA-022)
```

## API pública (`index.ts`)

| Função                                                                      | Para quê                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `gradeSubmission(exercise, submission, options?)`                           | Corrige; nunca lança exceção; retorna `GradingResult`.                                                  |
| `validateExercise(exercise, options?)`                                      | Valida planilha/alvo/gabarito, funções suportadas e se o próprio gabarito é aceito (teste de sanidade). |
| `evaluateFormula(sheet, targetCell, formula, options?)`                     | Só avalia (pré-visualização do professor, botão "testar").                                              |
| `toStudentResult(result)`                                                   | Remove `expectedValue` e `normalizedFormula`.                                                           |
| `normalizeFormula`, `tokenize`, `canonicalFunctionName`, `ptBrFunctionName` | Tokenizador/tradução pt-BR.                                                                             |
| `dateToSerial`, `serialToIsoDate`, `compareValues`, `parseConstant`         | Utilitários de valores.                                                                                 |
| `FEEDBACK_MESSAGES_PT_BR`                                                   | Texto padrão por `feedbackCode`.                                                                        |

`GradingResult`: `correct`, `feedbackCode`, `actualValue`, `actualType`, `expectedValue`, `valueMatches`,
`errors[] ({ kind: PARSE|EXCEL|LIMIT|EXERCISE|INTERNAL, code, message })`, `usedFunctions`,
`missingRequiredFunctions`, `forbiddenFunctionsUsed`, `unsupportedFunctions`, `referencesCells`,
`normalizedFormula`, `elapsedMs`.

`feedbackCode` (ordem de prioridade): `INVALID_EXERCISE`, `EMPTY_SUBMISSION`, `LIMIT_EXCEEDED`,
`FORMULA_REQUIRED`, `PARSE_ERROR`, `UNSUPPORTED_FUNCTION`, `FORBIDDEN_FUNCTION`, `HARDCODED_VALUE`,
`FORMULA_ERROR`, `WRONG_TYPE`, `WRONG_VALUE`, `MISSING_REQUIRED_FUNCTION`, `CORRECT`.

## Regras de correção

- Compara **valor**, não texto da fórmula: `=SUM(A1:A3)`, `=A1+A2+A3` e `=SOMA(A1;A2;A3)` são equivalentes.
- Cada correção usa uma instância nova e isolada de HyperFormula (destruída ao final).
- `requiredFunctions` (modo `all` ou `any`) e `forbiddenFunctions`: detectados por tokenização que ignora
  strings e nomes de planilha entre aspas; sem diferenciar maiúsculas; nomes pt-BR são traduzidos.
- Valor fixo: sem `=` → `FORMULA_REQUIRED` (salvo `allowConstants`); fórmula sem referência a células →
  `HARDCODED_VALUE` (salvo `requireCellReference: false`); `forbidLiteralExpectedValue` pega `=A1*0+60`.
- Números: tolerância absoluta `numberTolerance` (padrão `1e-9`) e/ou `relativeTolerance`.
- Textos: `trimStrings` (padrão `true`), `caseInsensitive` (padrão `false`, comparação pt-BR).
- Datas: `{ date: "YYYY-MM-DD" }` vira serial do Excel (sistema 1900, a partir de 01/03/1900).
- Célula vazia referenciada vale `0`, como no Excel.

## pt-BR e separadores

- Nomes de função em pt-BR (dicionário `ptPT` do HyperFormula, que segue os nomes do Excel brasileiro:
  SOMA, PROCV, CONT.SE, ARRUMAR…), também sem acento (`MEDIA`).
- `locale: "auto"` (padrão): se houver `;` fora de strings/arrays, `;` vira separador de argumentos e
  `1,5` vira `1.5`. `locale: "pt-BR"` força isso; `"en"` desliga.
- `VERDADEIRO`/`FALSO`/`TRUE`/`FALSE` soltos viram `TRUE()`/`FALSE()` (exigência do HyperFormula).

## Segurança e limites (`DEFAULT_LIMITS`)

Fórmula ≤ 2000 caracteres, aninhamento ≤ 64, planilha ≤ 1000 linhas × 100 colunas e ≤ 10 000 células,
texto de célula ≤ 10 000, resultado de texto ≤ 32 767. Ajustáveis por `options.limits`.

## Pendências / follow-ups

- **Timeout rígido:** HyperFormula é síncrono; os limites acima limitam o custo, e `elapsedMs` é reportado.
  Se for preciso um timeout preemptivo no servidor, rodar a correção em `worker_threads` (fora do escopo).
- Arrays em pt-BR (`{1;2\3;4}`) não são convertidos; constantes de array continuam no formato en-US.
- Divergências conhecidas do Excel (ex.: `INDIRECT` não existe no HyperFormula, bug de 1900) devem ir para a
  suíte de paridade (TA-034).
- O módulo não usa `server-only` nem APIs de Node, então pode ser usado no navegador pela grade (TA-021).
  Se o front for importá-lo, vale movê-lo para `src/lib/grading`.

## Análise estática (`analyzeFormula`)

A nota continua pelo valor, mas `gradeSubmission` também devolve `analysis` (e `analyzeFormula(formula)` pode
ser chamado sozinho). Serve de entrada para o feedback por IA e para o painel do professor:

- funções (`functions` com contagem, `uniqueFunctions`, `volatileFunctions`);
- referências (`references[]` com `kind`: cell, range, column-range, row-range; `anchor`: relative,
  absolute, mixed; `sheet`) e contadores;
- literais (`numbers`, `strings`, `booleans`), `hardcodedNumbers` (exceto 0 e 1);
- operadores (aritméticos, comparação, `&`), profundidade de aninhamento;
- `complexityScore` = 2×chamadas + funções distintas + operadores + 3×(profundidade−1) + 0,5×referências
  - 0,5×literais fixos; faixas: ≤2 trivial, ≤6 simple, ≤15 moderate, acima complex;
- `flags`: `onlyLiterals`, `usesHardcodedNumbers`, `deepNesting` (>3), `usesVolatileFunctions`,
  `usesAbsoluteReferences`.

## Exercícios com várias células (`gradeMultiCellSubmission`)

O schema do Backend 1 guarda vários alvos por exercício (`expectedResult: [{ cell, value?, formula?, tolerance? }]`).
`fromSchemaExercise(initialSheet, expectedResult, rules?)` converte esse JSON e `gradeMultiCellSubmission`
corrige todos os alvos. Os gabaritos são resolvidos com todos os gabaritos preenchidos; as respostas do aluno
para outros alvos entram na planilha (um alvo pode depender de outro). Células fora dos alvos são ignoradas.
