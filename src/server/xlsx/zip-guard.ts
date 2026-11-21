/**
 * Pre-flight inspection of an .xlsx (ZIP) container before handing it to the parser.
 * Reads only the central directory (no decompression): rejects non-ZIP content, truncated
 * files, macros, external links/connections, zip bombs and oversize archives.
 * Declared sizes can lie, so this is a first line of defence; see README (worker isolation).
 */

export interface ZipGuardLimits {
  maxEntries: number;
  maxTotalUncompressedBytes: number;
  maxEntryUncompressedBytes: number;
  maxCompressionRatio: number;
}

export const DEFAULT_ZIP_LIMITS: ZipGuardLimits = {
  maxEntries: 500,
  maxTotalUncompressedBytes: 10 * 1024 * 1024,
  maxEntryUncompressedBytes: 8 * 1024 * 1024,
  maxCompressionRatio: 150,
};

export type ZipGuardCode =
  | "INVALID_FORMAT"
  | "CORRUPTED_FILE"
  | "MACROS_NOT_ALLOWED"
  | "EXTERNAL_LINKS_NOT_ALLOWED"
  | "ZIP_BOMB"
  | "UNCOMPRESSED_TOO_LARGE";

export type ZipGuardResult =
  { ok: true; entries: string[] } | { ok: false; code: ZipGuardCode; detail: string };

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

export function inspectXlsxContainer(
  bytes: Uint8Array,
  limits: ZipGuardLimits = DEFAULT_ZIP_LIMITS,
): ZipGuardResult {
  if (bytes.length < 4) return { ok: false, code: "INVALID_FORMAT", detail: "empty" };
  if (OLE_MAGIC.every((b, i) => bytes[i] === b)) {
    return { ok: false, code: "INVALID_FORMAT", detail: "legacy .xls/OLE file" };
  }
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    return { ok: false, code: "INVALID_FORMAT", detail: "not a ZIP/.xlsx file" };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0)
    return { ok: false, code: "CORRUPTED_FILE", detail: "end of central directory not found" };
  const total = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (total === 0xffff || cdOffset === 0xffffffff)
    return { ok: false, code: "UNCOMPRESSED_TOO_LARGE", detail: "zip64" };
  if (total > limits.maxEntries)
    return { ok: false, code: "ZIP_BOMB", detail: `too many entries (${total})` };
  if (cdOffset + cdSize > eocd)
    return { ok: false, code: "CORRUPTED_FILE", detail: "central directory out of bounds" };

  const names: string[] = [];
  let sum = 0;
  let p = cdOffset;
  const decoder = new TextDecoder();
  for (let n = 0; n < total; n += 1) {
    if (p + 46 > eocd || view.getUint32(p, true) !== CDH_SIG) {
      return { ok: false, code: "CORRUPTED_FILE", detail: "bad central directory entry" };
    }
    const comp = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    names.push(name);
    sum += size;
    if (size > limits.maxEntryUncompressedBytes || sum > limits.maxTotalUncompressedBytes) {
      return { ok: false, code: "UNCOMPRESSED_TOO_LARGE", detail: name };
    }
    if (size > 1024 * 1024 && comp > 0 && size / comp > limits.maxCompressionRatio) {
      return { ok: false, code: "ZIP_BOMB", detail: name };
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  const lower = names.map((x) => x.toLowerCase());
  if (
    lower.some((x) => x.endsWith("vbaproject.bin") || (x.endsWith(".bin") && x.includes("vba")))
  ) {
    return { ok: false, code: "MACROS_NOT_ALLOWED", detail: "vbaProject.bin" };
  }
  if (lower.some((x) => x.startsWith("xl/externallinks/") || x === "xl/connections.xml")) {
    return { ok: false, code: "EXTERNAL_LINKS_NOT_ALLOWED", detail: "external links/connections" };
  }
  if (!lower.includes("[content_types].xml") || !lower.includes("xl/workbook.xml")) {
    return { ok: false, code: "INVALID_FORMAT", detail: "ZIP is not an Excel workbook" };
  }
  return { ok: true, entries: names };
}
