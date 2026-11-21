// @vitest-environment node
import { describe, expect, it } from "vitest";

import { compareValues, dateToSerial, parseConstant, serialToIsoDate } from "./values";

describe("datas (serial do Excel)", () => {
  it("converte ISO para serial e volta", () => {
    expect(dateToSerial("2026-01-01")).toBe(46023);
    expect(dateToSerial("1900-03-01")).toBe(61);
    expect(dateToSerial("2026-01-01T12:00")).toBe(46023.5);
    expect(serialToIsoDate(46023.75)).toBe("2026-01-01");
  });

  it("rejeita datas inválidas", () => {
    expect(() => dateToSerial("2026-02-30")).toThrow();
    expect(() => dateToSerial("21/11/2026")).toThrow();
  });
});

describe("compareValues", () => {
  it("usa tolerância absoluta e relativa", () => {
    expect(compareValues(0.1 + 0.2, 0.3)).toBe("match");
    expect(compareValues(10.004, 10, { numberTolerance: 0.01 })).toBe("match");
    expect(compareValues(10.02, 10, { numberTolerance: 0.01 })).toBe("wrong_value");
    expect(compareValues(1005, 1000, { relativeTolerance: 0.01 })).toBe("match");
  });

  it("compara textos com trim e opção case-insensitive", () => {
    expect(compareValues(" Ana ", "Ana")).toBe("match");
    expect(compareValues("ANA", "ana")).toBe("wrong_value");
    expect(compareValues("ÁGUA", "água", { caseInsensitive: true })).toBe("match");
  });

  it("detecta tipo diferente", () => {
    expect(compareValues("10", 10)).toBe("wrong_type");
    expect(compareValues(1, true)).toBe("wrong_type");
  });
});

describe("parseConstant", () => {
  it("lê números (ponto ou vírgula), lógicos e texto", () => {
    expect(parseConstant("1,5")).toBe(1.5);
    expect(parseConstant("-2.25")).toBe(-2.25);
    expect(parseConstant("VERDADEIRO")).toBe(true);
    expect(parseConstant("abc")).toBe("abc");
  });
});
