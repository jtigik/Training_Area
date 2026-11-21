import { describe, expect, it } from "vitest";
import { columnIndex, columnLabel, isA1, parseA1, toA1 } from "./a1";

describe("A1 addressing", () => {
  it.each([
    [0, "A"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [701, "ZZ"],
    [702, "AAA"],
  ])("column %i <-> %s", (index, label) => {
    expect(columnLabel(index)).toBe(label);
    expect(columnIndex(label)).toBe(index);
  });

  it("parses and formats addresses, including absolute refs and lowercase", () => {
    expect(parseA1("B7")).toEqual({ row: 6, col: 1 });
    expect(parseA1("$c$10")).toEqual({ row: 9, col: 2 });
    expect(toA1({ row: 0, col: 0 })).toBe("A1");
    expect(toA1(parseA1("AB12"))).toBe("AB12");
  });

  it("rejects invalid addresses", () => {
    expect(isA1("A0")).toBe(false);
    expect(isA1("1A")).toBe(false);
    expect(isA1("A1:B2")).toBe(false);
    expect(() => parseA1("hello")).toThrow(RangeError);
    expect(() => columnLabel(-1)).toThrow(RangeError);
  });
});
