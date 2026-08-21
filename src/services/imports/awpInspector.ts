import { createHash } from "node:crypto";
import { AwpFormatDetector } from "@/domain/mapa/import/awp/AwpFormatDetector";
import { metadataToRecord } from "@/domain/mapa/import/awp/AwpDocumentReader";
import { ContecAbpm50AwpParser } from "@/domain/mapa/import/awp/ContecAbpm50AwpParser";
import { anonymizeForAnalysis } from "@/domain/mapa/import/awp/AwpAnonymizer";
import { hexToBytes } from "@/domain/mapa/import/awp/decoders/ContecAwpHexMeasurementDecoder";
import { CONTEC_AWP_PARSER_VERSION } from "@/domain/mapa/import/awp/constants";
import { toUserMessage } from "@/domain/mapa/import/awp/errors";
import type {
  AwpRawRecord,
  ParseConfidence,
  ParseWarning,
} from "@/domain/mapa/import/awp/types";
import type { AnonymizedAwpStructure } from "@/domain/mapa/import/awp/AwpAnonymizer";

const HEX_RECORD = /^[0-9A-Fa-f\s]+$/;

export interface AwpInspection {
  file: {
    name: string;
    size: number;
    sha256: string;
    encoding: string;
    encodingEvidence: string[];
    textual: boolean;
    signature: string;
    detectedFormat: string;
    detectedVersion?: string;
    kind: string;
    confidence: ParseConfidence;
    parserVersion: string;
    formatEvidence: string[];
  };
  metadata: Array<{ key: string; value: string }>;
  records: AwpRawRecord[];
  unknownFields: string[];
  comments: string[];
  warnings: ParseWarning[];
  parseError?: string;
  /** Estrutura já anonimizada, único payload que pode ir para a IA. */
  anonymized: AnonymizedAwpStructure;
}

/**
 * Ferramenta de diagnóstico: nunca falha por causa de um arquivo ilegível.
 * Quando o parser recusa o arquivo, o Inspector ainda mostra bytes, metadados e
 * registros brutos — é exatamente esse o caso em que a engenharia reversa
 * precisa da tela.
 */
export async function inspectAwpBuffer(
  fileName: string,
  buffer: Buffer,
): Promise<AwpInspection> {
  const detector = new AwpFormatDetector();
  const detection = detector.detect({ buffer, fileName });
  const { descriptor, document } = detection;

  let records: AwpRawRecord[] = document.measurementRecords.map((entry, position) => {
    const isHex = HEX_RECORD.test(entry.value) && entry.value.replace(/\s+/g, "").length >= 8;
    return {
      index: Number(entry.key) || position + 1,
      key: entry.key,
      raw: entry.value,
      status: "UNDECODED" as const,
      bytes: isHex ? hexToBytes(entry.value) : Buffer.from(entry.value, "latin1").toJSON().data,
      note: "não decodificado nesta inspeção",
    };
  });

  let warnings: ParseWarning[] = [];
  let parseError: string | undefined;

  try {
    const result = await new ContecAbpm50AwpParser().parse(buffer, fileName);
    records = result.rawRecords.map((record) => ({
      ...record,
      bytes:
        record.bytes ?? Buffer.from(record.raw, "latin1").toJSON().data,
    }));
    warnings = result.warnings;
  } catch (error) {
    parseError = toUserMessage(error);
  }

  const metadata = metadataToRecord(document);

  return {
    file: {
      name: fileName,
      size: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      encoding: descriptor.encoding.encoding,
      encodingEvidence: descriptor.encoding.evidence,
      textual: descriptor.encoding.textual,
      signature: descriptor.signature,
      detectedFormat: descriptor.formatId,
      detectedVersion: descriptor.version,
      kind: descriptor.kind,
      confidence: descriptor.confidence,
      parserVersion: CONTEC_AWP_PARSER_VERSION,
      formatEvidence: descriptor.evidence,
    },
    metadata: Object.entries(metadata).map(([key, value]) => ({ key, value })),
    records,
    unknownFields: document.unknownFields.map((field) => `linha ${field.line}: ${field.text}`),
    comments: document.comments.map((comment) => `linha ${comment.line}: ${comment.text}`),
    warnings,
    parseError,
    anonymized: anonymizeForAnalysis({
      detectedFormat: descriptor.formatId,
      detectedVersion: descriptor.version,
      encoding: descriptor.encoding.encoding,
      metadata,
      rawRecords: records,
      unknownFields: document.unknownFields.map((field) => field.text),
      comments: document.comments.map((comment) => comment.text),
      warnings,
    }),
  };
}
