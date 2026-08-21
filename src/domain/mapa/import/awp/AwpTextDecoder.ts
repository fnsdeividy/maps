import type { EncodingDetection } from "./types";

/**
 * Windows-1252 difere de Latin-1 apenas na faixa 0x80–0x9F. Decodificar como
 * latin1 corromperia acentos e aspas tipográficas de arquivos gerados no Windows.
 */
const WINDOWS_1252_HIGH: Record<number, string> = {
  0x80: "\u20ac",
  0x82: "\u201a",
  0x83: "\u0192",
  0x84: "\u201e",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u02c6",
  0x89: "\u2030",
  0x8a: "\u0160",
  0x8b: "\u2039",
  0x8c: "\u0152",
  0x8e: "\u017d",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201c",
  0x94: "\u201d",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x98: "\u02dc",
  0x99: "\u2122",
  0x9a: "\u0161",
  0x9b: "\u203a",
  0x9c: "\u0153",
  0x9e: "\u017e",
  0x9f: "\u0178",
};

function isValidUtf8(buffer: Buffer): boolean {
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];
    let extra = 0;
    if (byte <= 0x7f) {
      i += 1;
      continue;
    }
    if (byte >= 0xc2 && byte <= 0xdf) extra = 1;
    else if (byte >= 0xe0 && byte <= 0xef) extra = 2;
    else if (byte >= 0xf0 && byte <= 0xf4) extra = 3;
    else return false;

    if (i + extra >= buffer.length) return false;
    for (let offset = 1; offset <= extra; offset += 1) {
      const continuation = buffer[i + offset];
      if (continuation < 0x80 || continuation > 0xbf) return false;
    }
    i += extra + 1;
  }
  return true;
}

function countNullBytes(buffer: Buffer, startAt: number): number {
  let count = 0;
  for (let i = startAt; i < buffer.length; i += 2) {
    if (buffer[i] === 0x00) count += 1;
  }
  return count;
}

function controlCharRatio(buffer: Buffer): number {
  if (buffer.length === 0) return 0;
  let control = 0;
  for (const byte of buffer) {
    const printable =
      byte === 0x09 || byte === 0x0a || byte === 0x0d || byte >= 0x20;
    if (!printable) control += 1;
  }
  return control / buffer.length;
}

/**
 * Detecta a codificação sem nunca assumir UTF-8 por padrão. Retorna também se o
 * conteúdo aparenta ser textual — quando não for, o Buffer original deve ser
 * preservado e tratado como binário.
 */
export function detectTextEncoding(buffer: Buffer): EncodingDetection {
  const evidence: string[] = [];

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return {
      encoding: "utf-8",
      hasBom: true,
      textual: true,
      evidence: ["BOM EF BB BF"],
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return {
      encoding: "utf-16le",
      hasBom: true,
      textual: true,
      evidence: ["BOM FF FE"],
    };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return {
      encoding: "utf-16be",
      hasBom: true,
      textual: true,
      evidence: ["BOM FE FF"],
    };
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  const pairs = Math.floor(sample.length / 2);

  if (pairs >= 8) {
    const oddNulls = countNullBytes(sample, 1);
    const evenNulls = countNullBytes(sample, 0);
    if (oddNulls / pairs > 0.6 && evenNulls / pairs < 0.1) {
      evidence.push(`bytes 0x00 em ${Math.round((oddNulls / pairs) * 100)}% das posições ímpares`);
      return { encoding: "utf-16le", hasBom: false, textual: true, evidence };
    }
    if (evenNulls / pairs > 0.6 && oddNulls / pairs < 0.1) {
      evidence.push(`bytes 0x00 em ${Math.round((evenNulls / pairs) * 100)}% das posições pares`);
      return { encoding: "utf-16be", hasBom: false, textual: true, evidence };
    }
  }

  const ratio = controlCharRatio(sample);
  if (ratio > 0.1) {
    evidence.push(`${Math.round(ratio * 100)}% de bytes de controle`);
    return { encoding: "binary", hasBom: false, textual: false, evidence };
  }

  const hasHighBytes = sample.some((byte) => byte >= 0x80);
  if (!hasHighBytes) {
    evidence.push("todos os bytes < 0x80");
    return { encoding: "ascii", hasBom: false, textual: true, evidence };
  }

  if (isValidUtf8(sample)) {
    evidence.push("sequências multibyte válidas em UTF-8");
    return { encoding: "utf-8", hasBom: false, textual: true, evidence };
  }

  evidence.push("bytes altos que não formam UTF-8 válido");
  return { encoding: "windows-1252", hasBom: false, textual: true, evidence };
}

function decodeWindows1252(buffer: Buffer): string {
  let text = "";
  for (const byte of buffer) {
    text += byte >= 0x80 && byte <= 0x9f
      ? (WINDOWS_1252_HIGH[byte] ?? "\ufffd")
      : String.fromCharCode(byte);
  }
  return text;
}

/** Converte o Buffer em texto usando a codificação detectada, removendo o BOM. */
export function decodeAwpText(buffer: Buffer, detection: EncodingDetection): string {
  switch (detection.encoding) {
    case "utf-16le": {
      const body = detection.hasBom ? buffer.subarray(2) : buffer;
      return body.toString("utf16le");
    }
    case "utf-16be": {
      const body = detection.hasBom ? buffer.subarray(2) : buffer;
      // Buffer.swap16 exige comprimento par e muta o buffer: copiar antes.
      const swapped = Buffer.from(body.subarray(0, body.length - (body.length % 2)));
      swapped.swap16();
      return swapped.toString("utf16le");
    }
    case "windows-1252":
      return decodeWindows1252(buffer);
    case "ascii":
      return buffer.toString("latin1");
    case "utf-8":
      return (detection.hasBom ? buffer.subarray(3) : buffer).toString("utf8");
    case "binary":
      return "";
    default:
      return "";
  }
}
