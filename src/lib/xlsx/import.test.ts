import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { cellText, looksLikeXlsx, parseXlsx, sheetToExercise } from "./import";

describe("sheetToExercise", () => {
  it("valores viram planilha bloqueada e fórmulas viram gabarito", () => {
    const s = sheetToExercise("Soma", [
      { address: "A1", value: "10" },
      { address: "A2", value: "20" },
      { address: "A3", value: "30", formula: "SUM(A1:A2)" },
    ]);
    expect(s.grid.cells).toEqual({
      A1: { value: "10", locked: true },
      A2: { value: "20", locked: true },
    });
    expect(s.answers).toEqual({ A3: { kind: "FORMULA", expected: "=SUM(A1:A2)" } });
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

describe("cellText", () => {
  it("lê fórmula, texto rico e datas", () => {
    expect(cellText({ formula: "A1*2", result: 4 })).toEqual({ value: "4", formula: "A1*2" });
    expect(cellText({ richText: [{ text: "Ol" }, { text: "á" }] })).toEqual({ value: "Olá" });
    expect(cellText(new Date("2026-01-02T00:00:00Z"))).toEqual({ value: "2026-01-02" });
    expect(cellText(null)).toEqual({ value: "" });
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
    expect(result.sheets[0].answers.B3).toEqual({ kind: "FORMULA", expected: "=AVERAGE(B1:B2)" });
    expect(result.sheets[0].valid).toBe(true);
    expect(result.sheets[1].valid).toBe(false);
  });
});
