import { describe, expect, it } from "vitest";
import { formatSerialDate } from "./dates";
import { SheetEngine } from "./engine";

describe("formatSerialDate (Excel 1900 system)", () => {
  it.each([
    [1, "01/01/1900"],
    [59, "28/02/1900"],
    [60, "29/02/1900"],
    [61, "01/03/1900"],
    [45658, "01/01/2025"],
    [46347, "21/11/2026"],
    [46347.75, "21/11/2026"],
  ])("%s -> %s", (serial, text) => expect(formatSerialDate(serial)).toBe(text));

  it("rejects non-date serials", () => {
    expect(formatSerialDate(0)).toBeNull();
    expect(formatSerialDate(-5)).toBeNull();
    expect(formatSerialDate(Number.NaN)).toBeNull();
  });

  it("is consistent with the engine's date functions", () => {
    const e = new SheetEngine({
      A1: { f: "=DATA(1900;1;1)" },
      A2: { f: "=DATA(1900;3;1)" },
      A3: { f: "=DATA(2026;11;21)" },
      A4: { f: "=DIA(60)" },
    });
    expect(e.getValue("A1")).toEqual({ kind: "number", value: 1 });
    expect(e.getValue("A2")).toEqual({ kind: "number", value: 61 });
    expect(e.getValue("A3")).toEqual({ kind: "number", value: 46347 });
    expect(e.getValue("A4")).toEqual({ kind: "number", value: 29 });
    e.destroy();
  });
});
