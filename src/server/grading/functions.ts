import { HyperFormula } from "hyperformula";
import ptPT from "hyperformula/i18n/languages/ptPT";

/**
 * Function-name registry: canonical (English) names supported by HyperFormula and
 * a pt-BR -> English translation table.
 *
 * HyperFormula's `ptPT` dictionary follows the Brazilian Excel names (SOMA, PROCV,
 * CONT.SE, ARRUMAR, CONT.NÚM…), so it is used as the pt-BR source. Accent-less
 * spellings (MEDIA, INDICE…) are accepted too, because students often type them.
 */

const stripAccents = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Canonical names registered in HyperFormula (upper-case English). */
export const HYPERFORMULA_FUNCTIONS: ReadonlySet<string> = new Set(
  HyperFormula.getRegisteredFunctionNames("enGB").map((n) => n.toUpperCase()),
);

/**
 * Brazilian Excel names that HyperFormula's ptPT dictionary lacks or spells the Portugal way.
 * Only entries whose canonical function exists in HyperFormula are registered.
 */
export const PT_BR_ALIASES: Readonly<Record<string, string>> = {
  SES: "IFS",
  SENÃODISP: "IFNA",
  PARÂMETRO: "SWITCH",
  MÁXIMOSES: "MAXIFS",
  MÍNIMOSES: "MINIFS",
  MÉDIASES: "AVERAGEIFS",
  FILTRO: "FILTER",
  CLASSIFICAR: "SORT",
  CLASSIFICARPOR: "SORTBY",
  ÚNICO: "UNIQUE",
  SEQUÊNCIA: "SEQUENCE",
  MATRIZALEATÓRIA: "RANDARRAY",
  CORRESPX: "XMATCH",
  ORDEM: "RANK",
  "ORDEM.EQ": "RANK.EQ",
  DATADIF: "DATEDIF",
  DIATRABALHO: "WORKDAY",
  DESVPAD: "STDEV",
  ESCOLHER: "CHOOSE",
  CONCAT: "CONCAT",
  "TEXTO.ANTES": "TEXTBEFORE",
  "TEXTO.DEPOIS": "TEXTAFTER",
  HIPERLINK: "HYPERLINK",
  ARRUMAR: "TRIM",
  "CONT.SES": "COUNTIFS",
  SOMASES: "SUMIFS",
  MÉDIASE: "AVERAGEIF",
  PROCX: "XLOOKUP",
  SEERRO: "IFERROR",
  ALEATÓRIOENTRE: "RANDBETWEEN",
  ALEATÓRIO: "RAND",
  AGORA: "NOW",
  HOJE: "TODAY",
  DIATRABALHOTOTAL: "NETWORKDAYS",
  FIMMÊS: "EOMONTH",
  DATAM: "EDATE",
  "NÚM.CARACT": "LEN",
  "EXT.TEXTO": "MID",
  ESQUERDA: "LEFT",
  DIREITA: "RIGHT",
  MAIÚSCULA: "UPPER",
  MINÚSCULA: "LOWER",
  "PRI.MAIÚSCULA": "PROPER",
  LOCALIZAR: "SEARCH",
  PROCURAR: "FIND",
  SUBSTITUIR: "SUBSTITUTE",
  CONCATENAR: "CONCATENATE",
  TEXTO: "TEXT",
  VALOR: "VALUE",
  TRUNCAR: "TRUNC",
  "ARREDONDAR.PARA.CIMA": "ROUNDUP",
  "ARREDONDAR.PARA.BAIXO": "ROUNDDOWN",
  ARRED: "ROUND",
  SOMARPRODUTO: "SUMPRODUCT",
  CORRESP: "MATCH",
  ÍNDICE: "INDEX",
  PROCH: "HLOOKUP",
  PROCV: "VLOOKUP",
  "CONT.VALORES": "COUNTA",
  "CONTAR.VAZIO": "COUNTBLANK",
  "CONT.NÚM": "COUNT",
  MÉDIA: "AVERAGE",
  MÁXIMO: "MAX",
  MÍNIMO: "MIN",
  MED: "MEDIAN",
  ÉERRO: "ISERROR",
  ÉERROS: "ISERR",
  ÉTEXTO: "ISTEXT",
  ÉNÚM: "ISNUMBER",
  "ÉCÉL.VAZIA": "ISBLANK",
  NÃO: "NOT",
  E: "AND",
  OU: "OR",
  "DIA.DA.SEMANA": "WEEKDAY",
  NÚMSEMANA: "WEEKNUM",
  ANO: "YEAR",
  MÊS: "MONTH",
  DIA: "DAY",
  DATA: "DATE",
  INT: "INT",
  RESTO: "MOD",
  POTÊNCIA: "POWER",
  RAIZ: "SQRT",
  TRANSPOR: "TRANSPOSE",
  DESLOC: "OFFSET",
};

/** localized upper-case name -> canonical English name */
const PT_TO_CANONICAL = new Map<string, string>();
/** accent-stripped localized name -> canonical English name */
const PT_NOACCENT_TO_CANONICAL = new Map<string, string>();
/** canonical -> localized pt-BR name */
const CANONICAL_TO_PT = new Map<string, string>();

(() => {
  const ambiguous = new Set<string>();
  const dictionary = (ptPT as { functions: Record<string, string> }).functions;
  for (const [canonical, localized] of Object.entries(dictionary)) {
    if (!localized) continue;
    const loc = localized.toUpperCase();
    const can = canonical.toUpperCase();
    CANONICAL_TO_PT.set(can, loc);
    // English names win on collision (e.g. INT, MOD, ABS are identical anyway).
    if (HYPERFORMULA_FUNCTIONS.has(loc)) continue;
    PT_TO_CANONICAL.set(loc, can);
    const plain = stripAccents(loc);
    if (HYPERFORMULA_FUNCTIONS.has(plain)) continue;
    const prev = PT_NOACCENT_TO_CANONICAL.get(plain);
    if (prev !== undefined && prev !== can) ambiguous.add(plain);
    PT_NOACCENT_TO_CANONICAL.set(plain, can);
  }
  for (const key of ambiguous) PT_NOACCENT_TO_CANONICAL.delete(key);
  for (const [alias, canonical] of Object.entries(PT_BR_ALIASES)) {
    if (!HYPERFORMULA_FUNCTIONS.has(canonical) || HYPERFORMULA_FUNCTIONS.has(alias)) continue;
    PT_TO_CANONICAL.set(alias, canonical);
    const plain = stripAccents(alias);
    if (!HYPERFORMULA_FUNCTIONS.has(plain)) PT_NOACCENT_TO_CANONICAL.set(plain, canonical);
    if (!CANONICAL_TO_PT.get(canonical)) CANONICAL_TO_PT.set(canonical, alias);
  }
})();

/**
 * Maps a function name as typed by the user (English or pt-BR, any case,
 * optional `_xlfn.` prefix) to its canonical English upper-case name.
 * Unknown names are returned upper-cased.
 */
export function canonicalFunctionName(name: string): string {
  let upper = name.trim().toUpperCase();
  upper = upper.replace(/^_XL(FN|WS)\./, "");
  if (HYPERFORMULA_FUNCTIONS.has(upper)) return upper;
  const fromPt = PT_TO_CANONICAL.get(upper) ?? PT_NOACCENT_TO_CANONICAL.get(stripAccents(upper));
  return fromPt ?? upper;
}

export function isKnownFunction(canonical: string): boolean {
  return HYPERFORMULA_FUNCTIONS.has(canonical);
}

/** pt-BR display name of a canonical function, for UI messages. */
export function ptBrFunctionName(canonical: string): string | undefined {
  return CANONICAL_TO_PT.get(canonical.toUpperCase());
}
