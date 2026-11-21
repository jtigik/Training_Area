import { parseAddress, toAddress } from "./grid";

/**
 * Avaliador mínimo de fórmulas para a PRÉ-VISUALIZAÇÃO do professor.
 * A correção oficial é do backend (motor de correção); aqui só cobrimos o básico:
 * números, referências (A1), intervalos (A1:B3), + - * / ^, parênteses, comparação
 * e as funções mais comuns em pt-BR e inglês.
 */
export type CellValue = number | string | boolean;
export type Lookup = (address: string) => string | undefined;

export class FormulaError extends Error {}

const FUNCTIONS: Record<string, (args: CellValue[][]) => CellValue> = {};
const nums = (args: CellValue[][]) =>
  args.flat().filter((v): v is number => typeof v === "number" && Number.isFinite(v));
const alias = (names: string[], fn: (args: CellValue[][]) => CellValue) =>
  names.forEach((n) => (FUNCTIONS[n] = fn));
alias(["SOMA", "SUM"], (a) => nums(a).reduce((s, v) => s + v, 0));
alias(["MÉDIA", "MEDIA", "AVERAGE"], (a) => {
  const n = nums(a);
  if (!n.length) throw new FormulaError("#DIV/0!");
  return n.reduce((s, v) => s + v, 0) / n.length;
});
alias(["MÍNIMO", "MINIMO", "MIN"], (a) => (nums(a).length ? Math.min(...nums(a)) : 0));
alias(["MÁXIMO", "MAXIMO", "MAX"], (a) => (nums(a).length ? Math.max(...nums(a)) : 0));
alias(["CONT.NÚM", "CONT.NUM", "COUNT"], (a) => nums(a).length);
alias(["CONT.VALORES", "COUNTA"], (a) => a.flat().filter((v) => v !== "").length);
alias(["ARRED", "ROUND"], (a) => {
  const [v, d] = [Number(a[0]?.[0] ?? 0), Number(a[1]?.[0] ?? 0)];
  const f = 10 ** d;
  return Math.round(v * f) / f;
});
alias(["SE", "IF"], (a) => (truthy(a[0]?.[0]) ? (a[1]?.[0] ?? true) : (a[2]?.[0] ?? false)));

function truthy(v: CellValue | undefined) {
  return typeof v === "string" ? v !== "" : Boolean(v);
}

function literal(raw: string | undefined): CellValue {
  const text = (raw ?? "").trim();
  if (text === "") return "";
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? n : text;
}

type Token = { t: "num" | "str" | "ref" | "fn" | "op" | "(" | ")" | "sep"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const re =
    /\s*(?:(\d+(?:[.,]\d+)?)|"([^"]*)"|([A-Za-z]{1,2}\d{1,3}(?::[A-Za-z]{1,2}\d{1,3})?)(?![\w.(])|([A-Za-zÀ-ú][\wÀ-ú.]*)\s*(?=\()|(<=|>=|<>|[+\-*/^&=<>])|(\()|(\))|([;,]))/y;
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) {
      i++;
      continue;
    }
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new FormulaError("#NOME?");
    i = re.lastIndex;
    if (m[1] !== undefined) out.push({ t: "num", v: m[1].replace(",", ".") });
    else if (m[2] !== undefined) out.push({ t: "str", v: m[2] });
    else if (m[3]) out.push({ t: "ref", v: m[3].toUpperCase() });
    else if (m[4]) out.push({ t: "fn", v: m[4].toUpperCase() });
    else if (m[5]) out.push({ t: "op", v: m[5] });
    else if (m[6]) out.push({ t: "(", v: "(" });
    else if (m[7]) out.push({ t: ")", v: ")" });
    else out.push({ t: "sep", v: m[8] });
  }
  return out;
}

export function evaluateFormula(formula: string, lookup: Lookup, depth = 0): CellValue {
  if (depth > 20) throw new FormulaError("#REF!");
  const tokens = tokenize(formula.replace(/^=/, ""));
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const cell = (address: string): CellValue => {
    const raw = lookup(address);
    if (raw?.trim().startsWith("=")) return evaluateFormula(raw, lookup, depth + 1);
    return literal(raw);
  };
  const range = (ref: string): CellValue[] => {
    const [a, b = a] = ref.split(":");
    const p = parseAddress(a);
    const q = parseAddress(b);
    if (!p || !q) throw new FormulaError("#REF!");
    const values: CellValue[] = [];
    for (let r = Math.min(p.row, q.row); r <= Math.max(p.row, q.row); r++)
      for (let c = Math.min(p.col, q.col); c <= Math.max(p.col, q.col); c++)
        values.push(cell(toAddress(r, c)));
    return values;
  };
  const num = (v: CellValue) => {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === "") return 0;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) throw new FormulaError("#VALOR!");
    return n;
  };

  function primary(): CellValue[] {
    const tk = next();
    if (!tk) throw new FormulaError("#ERRO!");
    if (tk.t === "num") return [Number(tk.v)];
    if (tk.t === "str") return [tk.v];
    if (tk.t === "ref") return range(tk.v);
    if (tk.t === "op" && tk.v === "-") return [-num(primary()[0])];
    if (tk.t === "op" && tk.v === "+") return [num(primary()[0])];
    if (tk.t === "(") {
      const v = comparison();
      if (next()?.t !== ")") throw new FormulaError("#ERRO!");
      return [v];
    }
    if (tk.t === "fn") {
      const fn = FUNCTIONS[tk.v];
      if (!fn) throw new FormulaError("#NOME?");
      next(); // (
      const args: CellValue[][] = [];
      if (peek()?.t !== ")") {
        do {
          args.push(argument());
        } while (peek()?.t === "sep" && next());
      }
      if (next()?.t !== ")") throw new FormulaError("#ERRO!");
      return [fn(args)];
    }
    throw new FormulaError("#ERRO!");
  }
  function argument(): CellValue[] {
    if (peek()?.t === "ref" && [")", "sep"].includes(tokens[pos + 1]?.t ?? ")")) return primary();
    return [comparison()];
  }
  function power(): CellValue {
    let v = primary()[0];
    while (peek()?.v === "^") {
      next();
      v = num(v) ** num(primary()[0]);
    }
    return v;
  }
  function term(): CellValue {
    let v = power();
    while (peek()?.v === "*" || peek()?.v === "/") {
      const op = next().v;
      const r = num(power());
      if (op === "/" && r === 0) throw new FormulaError("#DIV/0!");
      v = op === "*" ? num(v) * r : num(v) / r;
    }
    return v;
  }
  function additive(): CellValue {
    let v = term();
    while (peek()?.v === "+" || peek()?.v === "-" || peek()?.v === "&") {
      const op = next().v;
      const r = term();
      v = op === "&" ? `${v}${r}` : op === "+" ? num(v) + num(r) : num(v) - num(r);
    }
    return v;
  }
  function comparison(): CellValue {
    const v = additive();
    const op = peek();
    if (op?.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(op.v)) {
      next();
      const r = additive();
      const [a, b] = typeof v === "number" || typeof r === "number" ? [num(v), num(r)] : [v, r];
      return { "=": a === b, "<>": a !== b, "<": a < b, ">": a > b, "<=": a <= b, ">=": a >= b }[
        op.v
      ]!;
    }
    return v;
  }

  const result = comparison();
  if (pos < tokens.length) throw new FormulaError("#ERRO!");
  return result;
}

/** Valor que a célula exibiria (fórmula avaliada ou o texto digitado). */
export function displayValue(raw: string, lookup: Lookup): string {
  if (!raw.trim().startsWith("=")) return raw;
  try {
    const v = evaluateFormula(raw, lookup);
    if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
    return typeof v === "number" ? String(Math.round(v * 1e10) / 1e10) : v;
  } catch (e) {
    return e instanceof FormulaError ? e.message : "#ERRO!";
  }
}

/** Compara o valor de duas entradas (com tolerância numérica). */
export function sameValue(a: string, b: string, lookup: Lookup, tolerance = 0): boolean {
  const va = literal(displayValue(a, lookup));
  const vb = literal(displayValue(b, lookup));
  if (typeof va === "number" && typeof vb === "number")
    return Math.abs(va - vb) <= tolerance + 1e-9;
  return String(va).trim().toLowerCase() === String(vb).trim().toLowerCase();
}
