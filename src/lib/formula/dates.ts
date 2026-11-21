/**
 * Excel 1900 date system (with Lotus/Excel's fake 29/02/1900): serial 1 = 01/01/1900,
 * 60 = 29/02/1900, 61 = 01/03/1900. Matches the engine's HyperFormula config
 * (leapYear1900: true, nullDate 1899-12-31). Time fractions are ignored.
 */
const DAY_MS = 86_400_000;
const BEFORE_LEAP_BUG = Date.UTC(1899, 11, 31);
const AFTER_LEAP_BUG = Date.UTC(1899, 11, 30);

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/aaaa for an Excel serial, or null when it is not a valid date serial. */
export function formatSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const day = Math.floor(serial);
  if (day < 1 || day > 2_958_465) return null; // 31/12/9999
  if (day === 60) return "29/02/1900";
  const d = new Date((day < 60 ? BEFORE_LEAP_BUG : AFTER_LEAP_BUG) + day * DAY_MS);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
