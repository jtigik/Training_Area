// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  evaluateFormula,
  FEEDBACK_MESSAGES_PT_BR,
  gradeSubmission,
  toStudentResult,
  validateExercise,
  type ExerciseDefinition,
} from "./index";

/** A1:A3 = 10, 20, 30; B1 = 0; C1 = "maria"; target A4. */
const sumExercise: ExerciseDefinition = {
  sheet: [[10, 0, "maria"], [20], [30]],
  targetCell: "A4",
  expected: { value: 60 },
};

describe("gradeSubmission — qualquer fórmula que chegue ao resultado", () => {
  it.each([
    "=SUM(A1:A3)",
    "=A1+A2+A3",
    "=sum(a1:a3)",
    "  =SUM(A1,A2,A3)  ",
    "=SOMA(A1:A3)",
    "=AVERAGE(A1:A3)*3",
  ])("aceita %s", (formula) => {
    const r = gradeSubmission(sumExercise, formula);
    expect(r.feedbackCode).toBe("CORRECT");
    expect(r.correct).toBe(true);
    expect(r.actualValue).toBe(60);
    expect(r.expectedValue).toBe(60);
    expect(r.errors).toEqual([]);
  });

  it("reprova resultado errado e informa o valor obtido", () => {
    const r = gradeSubmission(sumExercise, "=SUM(A1:A2)");
    expect(r).toMatchObject({
      correct: false,
      feedbackCode: "WRONG_VALUE",
      actualValue: 30,
      valueMatches: false,
    });
    expect(r.usedFunctions).toEqual(["SUM"]);
  });

  it("reprova tipo errado (texto em vez de número)", () => {
    const r = gradeSubmission(sumExercise, '=TEXT(SUM(A1:A3),"0")');
    expect(r.feedbackCode).toBe("WRONG_TYPE");
    expect(r.actualValue).toBe("60");
  });

  it("avalia em instância isolada (uma correção não afeta a outra)", () => {
    gradeSubmission({ ...sumExercise, targetCell: "A1" }, "=999");
    expect(gradeSubmission(sumExercise, "=A1+A2+A3").actualValue).toBe(60);
  });

  it("aceita planilha no formato de mapa A1 e fórmulas na planilha inicial", () => {
    const ex: ExerciseDefinition = {
      sheet: { A1: 2, A2: 3, B1: "=A1*A2" },
      targetCell: "B2",
      expected: { value: 12 },
    };
    expect(gradeSubmission(ex, "=B1*2").feedbackCode).toBe("CORRECT");
  });
});

describe("funções obrigatórias e proibidas", () => {
  const ex: ExerciseDefinition = { ...sumExercise, requiredFunctions: ["sum"] };

  it("exige a função configurada mesmo com valor certo", () => {
    const r = gradeSubmission(ex, "=A1+A2+A3");
    expect(r.feedbackCode).toBe("MISSING_REQUIRED_FUNCTION");
    expect(r.correct).toBe(false);
    expect(r.valueMatches).toBe(true);
    expect(r.missingRequiredFunctions).toEqual(["SUM"]);
  });

  it("aceita a função em pt-BR ou minúsculas", () => {
    expect(gradeSubmission(ex, "=soma(A1:A3)").correct).toBe(true);
    expect(
      gradeSubmission({ ...sumExercise, requiredFunctions: ["SOMA"] }, "=SUM(A1:A3)").correct,
    ).toBe(true);
  });

  it("não conta nome de função dentro de string", () => {
    const strEx: ExerciseDefinition = {
      sheet: [[1]],
      targetCell: "B1",
      expected: { value: "SUM(1)" },
      requiredFunctions: ["SUM"],
    };
    const r = gradeSubmission(strEx, '=IF(A1=1,"SUM(1)","x")');
    expect(r.feedbackCode).toBe("MISSING_REQUIRED_FUNCTION");
    expect(r.usedFunctions).toEqual(["IF"]);
  });

  it("modo 'any' aceita qualquer uma das funções", () => {
    const anyEx: ExerciseDefinition = {
      ...sumExercise,
      requiredFunctions: ["SUM", "SUMPRODUCT"],
      requiredFunctionsMode: "any",
    };
    expect(gradeSubmission(anyEx, "=SUM(A1:A3)").correct).toBe(true);
    expect(gradeSubmission(anyEx, "=A1+A2+A3").feedbackCode).toBe("MISSING_REQUIRED_FUNCTION");
  });

  it("reprova função proibida", () => {
    const r = gradeSubmission({ ...sumExercise, forbiddenFunctions: ["SUM"] }, "=SUM(A1:A3)");
    expect(r.feedbackCode).toBe("FORBIDDEN_FUNCTION");
    expect(r.forbiddenFunctionsUsed).toEqual(["SUM"]);
  });

  it("reprova função desconhecida ou fora da lista permitida", () => {
    expect(gradeSubmission(sumExercise, "=FOO(A1:A3)").feedbackCode).toBe("UNSUPPORTED_FUNCTION");
    const r = gradeSubmission(sumExercise, "=SUM(A1:A3)", { allowedFunctions: ["AVERAGE"] });
    expect(r.feedbackCode).toBe("UNSUPPORTED_FUNCTION");
    expect(r.unsupportedFunctions).toEqual(["SUM"]);
  });
});

describe("erros de sintaxe e erros do Excel", () => {
  it.each(["=SUM(A1:A3", "=A1++*A2", '="abc', "=SUM(A1:A3))"])("PARSE_ERROR para %s", (f) => {
    const r = gradeSubmission(sumExercise, f);
    expect(r.feedbackCode).toBe("PARSE_ERROR");
    expect(r.errors[0]?.kind).toBe("PARSE");
  });

  it("#DIV/0!", () => {
    const r = gradeSubmission(sumExercise, "=A1/B1");
    expect(r.feedbackCode).toBe("FORMULA_ERROR");
    expect(r.actualType).toBe("error");
    expect(r.actualValue).toBe("#DIV/0!");
    expect(r.errors[0]).toMatchObject({ kind: "EXCEL", code: "#DIV/0!" });
  });

  it("#REF! (planilha inexistente)", () => {
    const r = gradeSubmission(sumExercise, "=Outra!A1+A1");
    expect(r.feedbackCode).toBe("FORMULA_ERROR");
    expect(r.errors[0]?.code).toBe("#REF!");
  });

  it("#VALUE! e #N/A", () => {
    expect(gradeSubmission(sumExercise, "=A1+C1").errors[0]?.code).toBe("#VALUE!");
    expect(gradeSubmission(sumExercise, "=VLOOKUP(99,A1:A3,1,FALSE)").errors[0]?.code).toBe("#N/A");
  });

  it("referência circular à própria célula", () => {
    const r = gradeSubmission(sumExercise, "=SUM(A1:A4)");
    expect(r.feedbackCode).toBe("FORMULA_ERROR");
    expect(r.errors[0]?.code).toBe("#CYCLE!");
  });

  it("nunca lança exceção com entrada inválida", () => {
    expect(() => gradeSubmission(sumExercise, null as unknown as string)).not.toThrow();
    expect(gradeSubmission(sumExercise, null as unknown as string).feedbackCode).toBe(
      "EMPTY_SUBMISSION",
    );
    expect(gradeSubmission(sumExercise, "=").feedbackCode).toBe("EMPTY_SUBMISSION");
  });
});

describe("valores fixos (hardcoded)", () => {
  it("exige '=' quando constantes não são permitidas", () => {
    const r = gradeSubmission(sumExercise, "60");
    expect(r.feedbackCode).toBe("FORMULA_REQUIRED");
    expect(r.valueMatches).toBe(true);
  });

  it("reprova fórmula sem referência a células", () => {
    expect(gradeSubmission(sumExercise, "=60").feedbackCode).toBe("HARDCODED_VALUE");
    expect(gradeSubmission(sumExercise, "=10+20+30").feedbackCode).toBe("HARDCODED_VALUE");
  });

  it("forbidLiteralExpectedValue pega truques como =A1*0+60", () => {
    expect(gradeSubmission(sumExercise, "=A1*0+60").correct).toBe(true);
    const strict = { ...sumExercise, forbidLiteralExpectedValue: true };
    expect(gradeSubmission(strict, "=A1*0+60").feedbackCode).toBe("HARDCODED_VALUE");
    expect(gradeSubmission(strict, "=SUM(A1:A3)").correct).toBe(true);
  });

  it("aceita constante quando o exercício permite", () => {
    const ex = { ...sumExercise, allowConstants: true };
    expect(gradeSubmission(ex, "60").correct).toBe(true);
    expect(gradeSubmission(ex, "=60").correct).toBe(true);
    expect(gradeSubmission(ex, "61").feedbackCode).toBe("WRONG_VALUE");
  });

  it("requireCellReference=false permite fórmulas sem referência (ex.: DATE)", () => {
    const ex: ExerciseDefinition = {
      sheet: [],
      targetCell: "A1",
      expected: { value: { date: "2026-11-21" } },
      requireCellReference: false,
    };
    expect(gradeSubmission(ex, "=DATE(2026,11,21)").correct).toBe(true);
  });
});

describe("tolerância, textos, lógicos e datas", () => {
  const ex: ExerciseDefinition = {
    sheet: [[10], [3]],
    targetCell: "B1",
    expected: { value: 3.333 },
    numberTolerance: 0.001,
  };

  it("aplica tolerância numérica", () => {
    expect(gradeSubmission(ex, "=A1/A2").correct).toBe(true);
    expect(gradeSubmission(ex, "=ROUND(A1/A2,1)").feedbackCode).toBe("WRONG_VALUE");
  });

  it("corrige imprecisão de ponto flutuante sem tolerância explícita", () => {
    const f: ExerciseDefinition = {
      sheet: [[0.1], [0.2]],
      targetCell: "B1",
      expected: { value: 0.3 },
    };
    expect(gradeSubmission(f, "=A1+A2").correct).toBe(true);
  });

  it("compara textos (sensível ou não a maiúsculas)", () => {
    const s: ExerciseDefinition = {
      sheet: [["maria"], ["silva"]],
      targetCell: "B1",
      expected: { value: "Maria Silva" },
    };
    expect(gradeSubmission(s, '=PROPER(A1&" "&A2)').correct).toBe(true);
    expect(gradeSubmission(s, '=A1&" "&A2').feedbackCode).toBe("WRONG_VALUE");
    expect(gradeSubmission({ ...s, caseInsensitive: true }, '=A1&" "&A2').correct).toBe(true);
  });

  it("compara lógicos", () => {
    const b: ExerciseDefinition = { sheet: [[7]], targetCell: "B1", expected: { value: true } };
    expect(gradeSubmission(b, "=A1>5").correct).toBe(true);
    expect(gradeSubmission(b, "=IF(A1>5,TRUE,FALSE)").correct).toBe(true);
    expect(gradeSubmission(b, "=A1>10").feedbackCode).toBe("WRONG_VALUE");
  });

  it("compara datas como serial do Excel", () => {
    const d: ExerciseDefinition = {
      sheet: [["=DATE(2026,1,31)"], [1]],
      targetCell: "B1",
      expected: { value: { date: "2026-02-28" } },
    };
    expect(gradeSubmission(d, "=EOMONTH(A1,A2)").correct).toBe(true);
    expect(gradeSubmission(d, "=A1+28").correct).toBe(true);
    expect(gradeSubmission(d, "=A1+27").feedbackCode).toBe("WRONG_VALUE");
  });

  it("célula vazia referenciada vale 0, como no Excel", () => {
    const z: ExerciseDefinition = { sheet: [[null, 5]], targetCell: "C1", expected: { value: 0 } };
    expect(gradeSubmission(z, "=A1").correct).toBe(true);
  });
});

describe("separador ';' e pt-BR", () => {
  it("aceita ';' como separador de argumentos", () => {
    expect(gradeSubmission(sumExercise, "=SUM(A1;A2;A3)").correct).toBe(true);
    expect(gradeSubmission(sumExercise, "=SOMA(A1:A2;A3)").correct).toBe(true);
  });

  it("aceita vírgula decimal quando usa ';'", () => {
    const ex: ExerciseDefinition = { sheet: [[10]], targetCell: "B1", expected: { value: 15 } };
    expect(gradeSubmission(ex, "=SE(A1>5;A1*1,5;0)").correct).toBe(true);
  });

  it("locale pt-BR forçado interpreta vírgula decimal sem ';'", () => {
    const ex: ExerciseDefinition = { sheet: [[10]], targetCell: "B1", expected: { value: 15 } };
    expect(gradeSubmission(ex, "=A1*1,5", { locale: "pt-BR" }).correct).toBe(true);
  });

  it("aceita PROCV / CONT.SE", () => {
    const ex: ExerciseDefinition = {
      sheet: [
        ["a", 1],
        ["b", 2],
        ["a", 3],
      ],
      targetCell: "D1",
      expected: { value: 2 },
      requiredFunctions: ["CONT.SE"],
    };
    const r = gradeSubmission(ex, '=CONT.SE(A1:A3;"a")');
    expect(r.correct).toBe(true);
    expect(r.usedFunctions).toEqual(["COUNTIF"]);
    expect(
      gradeSubmission(
        { ...ex, requiredFunctions: [], expected: { value: 3 } },
        '=PROCV("b";A1:B3;2;FALSO)+1',
      ).correct,
    ).toBe(true);
  });
});

describe("gabarito por fórmula e validação do exercício", () => {
  const ex: ExerciseDefinition = {
    ...sumExercise,
    expected: { formula: "=SUM(A1:A3)" },
    requiredFunctions: ["SUM"],
  };

  it("calcula o valor esperado a partir da fórmula-gabarito", () => {
    const r = gradeSubmission(ex, "=SOMA(A1;A2;A3)");
    expect(r.expectedValue).toBe(60);
    expect(r.correct).toBe(true);
  });

  it("teste de sanidade: o gabarito é aceito pelo próprio exercício", () => {
    expect(validateExercise(ex)).toMatchObject({ valid: true, expectedValue: 60, errors: [] });
  });

  it("acusa gabarito que viola as regras do exercício", () => {
    const bad = { ...ex, requiredFunctions: ["AVERAGE"] };
    const v = validateExercise(bad);
    expect(v.valid).toBe(false);
    expect(v.errors[0]?.code).toBe("ANSWER_KEY_NOT_ACCEPTED");
  });

  it("acusa gabarito com erro ou função não suportada", () => {
    expect(
      validateExercise({ ...sumExercise, expected: { formula: "=A1/B1" } }).errors[0]?.code,
    ).toBe("INVALID_EXPECTED_FORMULA");
    const v = validateExercise(
      { ...sumExercise, expected: { formula: "=SUM(A1:A3)" } },
      { allowedFunctions: ["AVERAGE"] },
    );
    expect(v.valid).toBe(false);
    expect(v.unsupportedFunctions).toEqual(["SUM"]);
  });

  it("exercício inválido retorna INVALID_EXERCISE sem lançar", () => {
    expect(gradeSubmission({ ...sumExercise, targetCell: "ZZZZ1" }, "=1").feedbackCode).toBe(
      "INVALID_EXERCISE",
    );
    expect(gradeSubmission({ ...sumExercise, expected: {} as never }, "=1").feedbackCode).toBe(
      "INVALID_EXERCISE",
    );
    expect(
      gradeSubmission({ ...sumExercise, expected: { value: { date: "x" } } }, "=1").feedbackCode,
    ).toBe("INVALID_EXERCISE");
  });
});

describe("limites de segurança", () => {
  it("fórmula longa demais", () => {
    const r = gradeSubmission(sumExercise, "=" + "A1+".repeat(1000) + "A1");
    expect(r.feedbackCode).toBe("LIMIT_EXCEEDED");
  });

  it("aninhamento profundo demais", () => {
    const deep = "=" + "ABS(".repeat(70) + "A1" + ")".repeat(70);
    expect(gradeSubmission(sumExercise, deep).feedbackCode).toBe("LIMIT_EXCEEDED");
  });

  it("planilha grande demais ou alvo fora da área", () => {
    expect(gradeSubmission({ ...sumExercise, targetCell: "A5000" }, "=A1").feedbackCode).toBe(
      "LIMIT_EXCEEDED",
    );
    const big = Array.from({ length: 1001 }, () => [1]);
    expect(gradeSubmission({ ...sumExercise, sheet: big }, "=A1").feedbackCode).toBe(
      "LIMIT_EXCEEDED",
    );
  });

  it("resultado de texto gigante", () => {
    const r = gradeSubmission({ ...sumExercise, expected: { value: "x" } }, '=REPT("ab",A1*10000)');
    expect(r.feedbackCode).toBe("LIMIT_EXCEEDED");
  });

  it("correção é rápida", () => {
    const r = gradeSubmission(sumExercise, "=SUM(A1:A3)");
    expect(r.elapsedMs).toBeLessThan(500);
  });
});

describe("apoio a UI", () => {
  it("toStudentResult remove o gabarito", () => {
    const s = toStudentResult(gradeSubmission(sumExercise, "=A1"));
    expect(s).not.toHaveProperty("expectedValue");
    expect(s).not.toHaveProperty("normalizedFormula");
    expect(s.feedbackCode).toBe("WRONG_VALUE");
  });

  it("evaluateFormula serve para pré-visualização", () => {
    const e = evaluateFormula(sumExercise.sheet, "A4", "=MÉDIA(A1:A3)");
    expect(e).toMatchObject({
      value: 20,
      type: "number",
      usedFunctions: ["AVERAGE"],
      referencesCells: true,
    });
  });

  it("há mensagem pt-BR para todo código", () => {
    for (const msg of Object.values(FEEDBACK_MESSAGES_PT_BR)) expect(msg.length).toBeGreaterThan(5);
  });
});
