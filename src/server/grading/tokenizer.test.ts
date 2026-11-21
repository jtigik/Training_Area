// @vitest-environment node
import { describe, expect, it } from "vitest";

import { canonicalFunctionName, ptBrFunctionName } from "./functions";
import { normalizeFormula, tokenize } from "./tokenizer";

describe("tokenize", () => {
  it("ignora nomes de função dentro de strings e nomes de planilha entre aspas", () => {
    const n = normalizeFormula(`=CONCATENATE("SUM(", 'MAX(x)'!A1, "IF(")`);
    expect(n.functionCalls).toEqual(["CONCATENATE"]);
  });

  it("trata aspas duplicadas como escape", () => {
    const tokens = tokenize(`"a ""SUM(1)"" b"&A1`);
    expect(tokens[0]).toEqual({ kind: "string", text: `"a ""SUM(1)"" b"` });
    expect(tokens.filter((t) => t.kind === "ident").map((t) => t.text)).toEqual(["A1"]);
  });

  it("reconhece funções com ponto e dígitos (STDEV.S, LOG10)", () => {
    expect(normalizeFormula("=stdev.s(A1:A3)+log10(B1)").functionCalls).toEqual([
      "STDEV.S",
      "LOG10",
    ]);
  });
});

describe("normalizeFormula", () => {
  it("é case-insensitive e canoniza para inglês", () => {
    const n = normalizeFormula("=sum(a1:a3)");
    expect(n.formula).toBe("=SUM(a1:a3)");
    expect(n.functionCalls).toEqual(["SUM"]);
  });

  it("traduz nomes pt-BR e converte ';' e vírgula decimal", () => {
    const n = normalizeFormula('=SE(SOMA(A1:A3)>1,5;"sim";"não")');
    expect(n.locale).toBe("pt-BR");
    expect(n.formula).toBe('=IF(SUM(A1:A3)>1.5,"sim","não")');
    expect(n.functionCalls).toEqual(["IF", "SUM"]);
  });

  it("não mexe em ';' dentro de strings", () => {
    const n = normalizeFormula('=CONCATENATE(A1,"a;b")');
    expect(n.locale).toBe("en");
    expect(n.formula).toBe('=CONCATENATE(A1,"a;b")');
  });

  it("aceita nomes pt-BR sem acento e com pontos", () => {
    expect(canonicalFunctionName("média")).toBe("AVERAGE");
    expect(canonicalFunctionName("MEDIA")).toBe("AVERAGE");
    expect(canonicalFunctionName("cont.se")).toBe("COUNTIF");
    expect(canonicalFunctionName("PROCV")).toBe("VLOOKUP");
    expect(canonicalFunctionName("_xlfn.XLOOKUP")).toBe("XLOOKUP");
    expect(ptBrFunctionName("SUM")).toBe("SOMA");
  });

  it("converte TRUE/FALSE/VERDADEIRO/FALSO soltos em chamadas", () => {
    expect(normalizeFormula("=IF(A1,VERDADEIRO,false)").formula).toBe("=IF(A1,TRUE(),FALSE())");
  });

  it("mede a profundidade de aninhamento", () => {
    expect(normalizeFormula("=IF(A1,IF(A2,SUM(A3),0),0)").maxDepth).toBe(3);
  });
});
