# Motor de correção de fórmulas (`src/server/grading`)

Serviço puro em TypeScript que corrige a resposta do aluno para um exercício de Excel usando
[HyperFormula](https://hyperformula.handsontable.com/). Não depende de banco, Prisma nem Next.js.

> **Licença:** HyperFormula é **GPL-3.0**. **Decidido (21/11/2026):** o repositório passa a ser
> GPL-3.0, então a chave `'gpl-v3'` (`config.ts`) é a definitiva e não há mais bloqueio.

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
`FORMULA_REQUIRED`, `PARSE_ERROR`, `UNSUPPORTED_FUNCTION`, `FORBIDDEN_FUNCTION`, `VOLATILE_FUNCTION`,
`HARDCODED_VALUE`,
`FORMULA_ERROR`, `WRONG_TYPE`, `WRONG_VALUE`, `INPUT_INSENSITIVE`, `MISSING_REQUIRED_FUNCTION`,
`CORRECT`.

## Regras de correção

- Compara **valor**, não texto da fórmula: `=SUM(A1:A3)`, `=A1+A2+A3` e `=SOMA(A1;A2;A3)` são equivalentes.
- Cada correção usa uma instância nova e isolada de HyperFormula (destruída ao final).
- `requiredFunctions` (modo `all` ou `any`) e `forbiddenFunctions`: detectados por tokenização que ignora
  strings e nomes de planilha entre aspas; sem diferenciar maiúsculas; nomes pt-BR são traduzidos.
- Valor fixo: sem `=` → `FORMULA_REQUIRED` (salvo `allowConstants`). Fórmula sem referência a células →
  `HARDCODED_VALUE`; o padrão de `requireCellReference` é "o gabarito usa células?" — então um gabarito
  `=TODAY()`/`=PI()*2` aceita respostas sem referência e passa em `validateExercise`.
- `forbidLiteralExpectedValue` (**ligado por padrão**, decisão do PO; desligado com `allowConstants`):
  um literal igual ao valor esperado (`=A1*0+60`) → `HARDCODED_VALUE`. Se o próprio gabarito contém um
  literal igual ao esperado (`=A1*2` com A1=1, `=SE(C1>=60;"Aprovado";…)`), a regra não se aplica.
- **Teste de sensibilidade** (`sensitivityCheck`, padrão `true`, decisão do PO): depois que o valor bate,
  as células de entrada numéricas e lógicas (não fórmula, não texto, fora a célula-alvo, até 2000) são
  perturbadas de forma determinística em 3 variações — `x+1`, `2x+3`, `3x+(k mod 4)+1` (preservam sinal e
  inteiros; lógicos invertidos na 2ª) — e a fórmula do aluno e a de referência são reavaliadas. Qualquer
  divergência → `INPUT_INSENSITIVE` (`result.sensitivity` traz os detalhes). Erros só "batem" se forem o
  mesmo código (`#N/D` × `#N/D`).
  - Referência = `expected.formula`, ou `referenceFormula` quando o gabarito é só valor.
  - **Gabarito só com valor e sem `referenceFormula`: o teste é pulado** (`skippedReason:
"NO_REFERENCE_FORMULA"`); sobram só as regras de valor fixo. Funções voláteis (`HOJE`, `ALEATÓRIO`,
    `DESLOC`, `INDIRETO`…) também pulam (`VOLATILE_FUNCTION`).
  - Efeito pedagógico: coincidências de valor deixam de passar (`=TRUNCAR(B1/3;2)` × `=ARRED(B1/3;2)`,
    `=SE(C1>=70;"B";"C")` sem o ramo "A", `PROCV(...;VERDADEIRO)` × `FALSO`, arredondar quando o gabarito
    não arredonda).
- Números: tolerância absoluta `numberTolerance` (padrão `1e-9`) e/ou `relativeTolerance`.
- Textos: `trimStrings` (padrão `true`), `caseInsensitive` (padrão `false`, comparação pt-BR).
- Datas: `{ date: "YYYY-MM-DD" }` vira serial do Excel (sistema 1900, a partir de 01/03/1900).
- Célula vazia referenciada vale `0`, como no Excel.
- **Tipos preservados:** string na planilha inicial é sempre texto (`"10"` não vira número, `"21/11/2026"`
  não vira data). Um apóstrofo inicial segue a convenção do Excel (`"'10"` = texto `10`); use `''` para um
  apóstrofo literal. Números, booleanos e `{ date }` mantêm seus tipos.
- Aritmética de matriz no estilo Excel 365 (`=SOMA(A1:A3*1)`) é aceita (`useArrayArithmetic`).
- **Funções voláteis proibidas por padrão** (decisão do PO): `ALEATÓRIO`/RAND, `ALEATÓRIOENTRE`/RANDBETWEEN,
  `AGORA`/NOW, `HOJE`/TODAY (e RANDARRAY). Resposta do aluno com uma delas → `VOLATILE_FUNCTION`;
  gabarito (ou `referenceFormula`) com uma delas → `validateExercise` inválido com código
  `VOLATILE_FUNCTION` (e `gradeSubmission` → `INVALID_EXERCISE`). `allowVolatileFunctions: true` libera.
- Todas as funções do HyperFormula são permitidas por padrão (`allowedFunctions` restringe, se informado).

## pt-BR e separadores

- Nomes de função em pt-BR (dicionário `ptPT` do HyperFormula, que segue os nomes do Excel brasileiro:
  SOMA, PROCV, CONT.SE, ARRUMAR…), também sem acento (`MEDIA`).
- Apelidos pt-BR que o dicionário não traz: `SES`→IFS, `SENÃODISP`→IFNA, `HIPERLINK`→HYPERLINK, `PARÂMETRO`→SWITCH,
  `MÁXIMOSES`/`MÍNIMOSES`, `FILTRO`, `ÚNICO`, `CLASSIFICAR`, `SEQUÊNCIA`, `DATADIF`… (com e sem acento;
  só os que o HyperFormula implementa — `MÉDIASES`, `CORRESPX`, `ORDEM`, `CONCAT` continuam sem suporte).
- `locale: "auto"` (padrão): se houver `;` fora de strings/arrays, `;` vira separador de argumentos e
  `1,5` vira `1.5`. `locale: "pt-BR"` força isso; `"en"` desliga.
- **Heurística de vírgula decimal** (modo `auto`, sem `;`): uma vírgula entre dígitos é decimal quando
  **não** está na lista de argumentos de uma função — `=A1*0,975` → `0.975`, `=(A1+1,5)*2` → `1.5`; mas
  `=ROUND(A1,2)` e `=ARRED(A1*1,5,2)` continuam com `,` separando argumentos (ambíguo: escreva com `;`
  para ter decimal dentro de função). `NormalizedFormula.decimalCommaHeuristic` indica quando foi aplicada.
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

## Dataset de regressão do QA (`dataset.test.ts`)

Cópia do dataset de 157 fórmulas (`__fixtures__/qa-dataset`, origem `qa/excel_formulas`). Divergências
do oráculo **por design** (decisões do PO de 21/11/2026): F-050, F-118, F-120, F-122 →
`INPUT_INSENSITIVE` (teste de sensibilidade). Todo o resto bate com o oráculo (inclusive os casos
de `VOLATILE_FUNCTION` e de aritmética de matriz).
