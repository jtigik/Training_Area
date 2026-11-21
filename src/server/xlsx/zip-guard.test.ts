// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { inspectXlsxContainer } from "./zip-guard";

const fx = (name: string) =>
  new Uint8Array(fs.readFileSync(path.join(__dirname, "__fixtures__/qa", name)));

describe("inspectXlsxContainer (fixtures do QA)", () => {
  it("aceita o .xlsx válido", () => {
    expect(inspectXlsxContainer(fx("exercicio-valido.xlsx")).ok).toBe(true);
    expect(inspectXlsxContainer(fx("exercicio-sem-gabarito.xlsx")).ok).toBe(true);
  });
  it("recusa .xlsx truncado como CORRUPTED_FILE", () => {
    expect(inspectXlsxContainer(fx("exercicio-corrompido.xlsx"))).toMatchObject({
      ok: false,
      code: "CORRUPTED_FILE",
    });
  });
  it("recusa CSV e .xls (OLE) como INVALID_FORMAT", () => {
    expect(inspectXlsxContainer(fx("exercicio-formato-errado.csv"))).toMatchObject({
      ok: false,
      code: "INVALID_FORMAT",
    });
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(inspectXlsxContainer(ole)).toMatchObject({ ok: false, code: "INVALID_FORMAT" });
  });
  it("aceita um workbook gerado pelo exceljs", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Dados").addRow(["Título", "x"]);
    const buf = new Uint8Array(await wb.xlsx.writeBuffer());
    expect(inspectXlsxContainer(buf).ok).toBe(true);
  });
});
