import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  cellContent,
  looksLikeXlsx,
  parseDifficulty,
  parseLevel,
  parseXlsx,
  sheetToExercise,
  templateToExercise,
} from "./import";

describe("sheetToExercise", () => {
  it("valores viram planilha bloqueada e fórmulas viram gabarito", () => {
    const s = sheetToExercise("Soma", [
      { address: "A1", value: 10 },
      { address: "A2", value: "20" },
      { address: "A3", value: 30, formula: "SUM(A1:A2)" },
    ]);
    expect(s.grid.cells).toEqual({
      A1: { value: 10, locked: true },
      A2: { value: "20", locked: true },
    });
    expect(s.answers).toEqual({ A3: { kind: "FORMULA", expected: { f: "=SUM(A1:A2)" } } });
    expect(s.grid.rows).toBe(4);
    expect(s.grid.cols).toBe(2);
    expect(s.valid).toBe(true);
  });

  it("avisa quando não há fórmula e ignora células fora do limite", () => {
    const s = sheetToExercise("Dados", [
      { address: "A1", value: "x" },
      { address: "A99", value: "fora" },
    ]);
    expect(s.valid).toBe(false);
    expect(s.warnings.join(" ")).toMatch(/fora do limite/);
    expect(s.warnings.join(" ")).toMatch(/Nenhuma fórmula/);
  });
});

describe("cellContent", () => {
  it("preserva tipos e lê fórmula, texto rico e datas", () => {
    expect(cellContent(10)).toEqual({ value: 10 });
    expect(cellContent("10")).toEqual({ value: "10" });
    expect(cellContent(true)).toEqual({ value: true });
    expect(cellContent({ formula: "A1*2", result: 4 })).toEqual({ value: 4, formula: "A1*2" });
    expect(cellContent({ richText: [{ text: "Ol" }, { text: "á" }] })).toEqual({ value: "Olá" });
    expect(cellContent(new Date("2026-01-02T00:00:00Z"))).toEqual({ value: "2026-01-02" });
    expect(cellContent(null)).toEqual({ value: null });
  });
});

describe("parseXlsx", () => {
  it("recusa conteúdo que não é zip", async () => {
    const buf = new TextEncoder().encode("not a zip").buffer;
    expect(looksLikeXlsx(buf)).toBe(false);
    expect((await parseXlsx("x.xlsx", buf)).error).toMatch(/não é uma planilha/);
  });

  it("lê um .xlsx real com duas abas", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Média");
    ws.getCell("B1").value = 7;
    ws.getCell("B2").value = 9;
    ws.getCell("B3").value = { formula: "AVERAGE(B1:B2)", result: 8 };
    wb.addWorksheet("Vazia").getCell("A1").value = "só texto";
    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const result = await parseXlsx("aula.xlsx", buffer);
    expect(result.error).toBeNull();
    expect(result.sheets.map((s) => s.name)).toEqual(["Média", "Vazia"]);
    expect(result.sheets[0].answers.B3).toEqual({
      kind: "FORMULA",
      expected: { f: "=AVERAGE(B1:B2)" },
    });
    expect(result.sheets[0].valid).toBe(true);
    expect(result.sheets[1].valid).toBe(false);
  });
});

describe("modelo Dados/Planilha/Gabarito", () => {
  it("lê metadados, grade e gabarito", async () => {
    const wb = new ExcelJS.Workbook();
    const dados = wb.addWorksheet("Dados");
    [
      ["Título", "e2e — Soma importada"],
      ["Nível", "Fundamental"],
      ["Dificuldade", "Muito fácil"],
      ["Enunciado", "Some A1:A3 em A4."],
      ["Dica", "Use SOMA."],
    ].forEach((r) => dados.addRow(r));
    const p = wb.addWorksheet("Planilha");
    p.getCell("A1").value = 10;
    p.getCell("A2").value = 20;
    p.getCell("A3").value = 30;
    p.getCell("B1").value = "10";
    p.getCell("B2").value = { formula: "A1*2", result: 20 };
    const g = wb.addWorksheet("Gabarito");
    g.addRow(["Célula", "Resposta", "Tolerância"]);
    g.addRow(["A4", "=SOMA(A1:A3)"]);
    g.addRow(["C1", 60, 0.5]);
    const result = await parseXlsx("valido.xlsx", (await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(result.sheets).toHaveLength(1);
    const [s] = result.sheets;
    expect(s.meta).toEqual({
      title: "e2e — Soma importada",
      level: "FUNDAMENTAL",
      difficulty: "VERY_EASY",
      statement: "Some A1:A3 em A4.",
      hint: "Use SOMA.",
    });
    expect(s.grid.cells.A1).toEqual({ value: 10, locked: true });
    expect(s.grid.cells.B1).toEqual({ value: "10", locked: true });
    expect(s.grid.cells.B2).toEqual({ value: { f: "=A1*2", v: 20 }, locked: true });
    expect(s.answers).toEqual({
      A4: { kind: "FORMULA", expected: { f: "=SOMA(A1:A3)" } },
      C1: { kind: "VALUE", expected: 60, tolerance: 0.5 },
    });
    expect(s.valid).toBe(true);
  });

  it("sem gabarito e com nível Dashboard fica inválido com avisos", () => {
    const s = templateToExercise({
      dados: [
        ["Título", "X"],
        ["Nível", "Dashboard"],
        ["Dificuldade", "Fácil"],
        ["Enunciado", "E"],
      ],
      planilha: [{ address: "A1", value: 1 }],
      gabarito: [],
    });
    expect(s.valid).toBe(false);
    expect(s.warnings.join(" ")).toMatch(/Dashboard.*MVP/);
    expect(s.warnings.join(" ")).toMatch(/Sem gabarito/);
  });

  it("lê vários exercícios (Dados (2), Gabarito (2)…) e aponta a aba real no erro", async () => {
    const wb = new ExcelJS.Workbook();
    for (const n of [1, 2]) {
      const sfx = n === 1 ? "" : ` (${n})`;
      const d = wb.addWorksheet(`Dados${sfx}`);
      [
        ["Título", `Ex ${n}`],
        ["Nível", "Fundamental"],
        ["Dificuldade", "Fácil"],
        ["Enunciado", "E"],
      ].forEach((r) => d.addRow(r));
      wb.addWorksheet(`Planilha${sfx}`).getCell("A1").value = 1;
      const g = wb.addWorksheet(`Gabarito${sfx}`);
      g.addRow(["Célula", "Resposta"]);
      g.addRow(["A2", "=A1*2"]);
      if (n === 2) g.addRow(["B4", null]);
    }
    const result = await parseXlsx("multi.xlsx", (await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(result.sheets.map((s) => s.name)).toEqual(["Ex 1", "Ex 2"]);
    expect(result.sheets[0].valid).toBe(true);
    expect(result.sheets[1].issues).toEqual([
      expect.objectContaining({
        sheet: "Gabarito (2)",
        row: 3,
        cell: "B3",
        code: "MISSING_ANSWER",
      }),
    ]);
  });

  it("converte rótulos de nível e dificuldade", () => {
    expect(parseLevel("avançado")).toBe("ADVANCED");
    expect(parseLevel("Dashboard")).toBeUndefined();
    expect(parseDifficulty("muito dificil")).toBe("VERY_HARD");
  });
});
