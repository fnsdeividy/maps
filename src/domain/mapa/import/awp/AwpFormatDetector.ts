import { decodeAwpText, detectTextEncoding } from "./AwpTextDecoder";
import { findMetadata, readAwpDocument } from "./AwpDocumentReader";
import { isVerifiedFormat } from "./verifiedFormats";
import type { AwpDocument, AwpFormatDescriptor, ParseConfidence } from "./types";

const MAIN_VERSION_KEYS = ["FileVersion_Main", "FileVersionMain", "FileVersion", "Version"];
const SUB_VERSION_KEYS = ["FileVersion_Sub", "FileVersionSub", "SubVersion"];
const VERSION_LIKE = /version|versao|versão/i;
const DEVICE_LIKE = /contec|abpm|sp[- ]?a|bloodpressure/i;

export interface AwpDetectionInput {
  buffer: Buffer;
  fileName: string;
}

export interface AwpDetection {
  descriptor: AwpFormatDescriptor;
  text: string;
  document: AwpDocument;
}

function slugifyVersion(main?: string, sub?: string): string | undefined {
  if (!main && !sub) return undefined;
  return [main, sub].filter(Boolean).join(".");
}

function collectVersionFields(document: AwpDocument): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const entry of document.metadata) {
    if (VERSION_LIKE.test(entry.key)) fields[entry.key] = entry.value;
  }
  return fields;
}

/**
 * Inspeciona bytes iniciais, codificação, estrutura `chave=valor`, campos de
 * versão e quantidade de registros para decidir qual layout o arquivo usa.
 *
 * Nunca presume que todo .awp tem o mesmo layout: quando as evidências não são
 * suficientes o formato é reportado como UNKNOWN e o parser se recusa a chutar.
 */
export class AwpFormatDetector {
  detect({ buffer, fileName }: AwpDetectionInput): AwpDetection {
    const encoding = detectTextEncoding(buffer);
    const text = decodeAwpText(buffer, encoding);
    const document = readAwpDocument(text);
    const signature = buffer
      .subarray(0, Math.min(16, buffer.length))
      .toString("hex")
      .toUpperCase()
      .replace(/(.{2})/g, "$1 ")
      .trim();

    const evidence: string[] = [
      `extensão: ${fileName.slice(fileName.lastIndexOf(".")).toLowerCase() || "sem extensão"}`,
      `codificação: ${encoding.encoding}${encoding.hasBom ? " (com BOM)" : ""}`,
      ...encoding.evidence,
    ];

    if (!encoding.textual) {
      return {
        text,
        document,
        descriptor: {
          formatId: "awp-binary-unknown",
          label: "Arquivo binário não reconhecido",
          kind: "BINARY",
          versionFields: {},
          encoding,
          signature,
          recordCount: 0,
          metadataCount: 0,
          evidence: [...evidence, "conteúdo não textual"],
          confidence: "UNKNOWN",
        },
      };
    }

    const versionFields = collectVersionFields(document);
    const main = findMetadata(document, MAIN_VERSION_KEYS)?.value;
    const sub = findMetadata(document, SUB_VERSION_KEYS)?.value;
    const version = slugifyVersion(main, sub);

    if (main) evidence.push(`FileVersion_Main=${main}`);
    if (sub) evidence.push(`FileVersion_Sub=${sub}`);

    const hasKeyValue = document.metadata.length > 0 || document.measurementRecords.length > 0;
    const kind = hasKeyValue
      ? "INI_TEXT"
      : document.unknownFields.length > 0
        ? "DELIMITED_TEXT"
        : "UNKNOWN";

    const deviceEvidence = [...document.metadata]
      .filter((entry) => DEVICE_LIKE.test(entry.key) || DEVICE_LIKE.test(entry.value))
      .map((entry) => `${entry.key}=${entry.value}`);
    evidence.push(...deviceEvidence);

    if (document.sections.length > 0) {
      evidence.push(`seções: ${document.sections.join(", ")}`);
    }
    evidence.push(`${document.measurementRecords.length} registros numerados`);

    const formatId = this.buildFormatId(kind, version, document);

    let confidence: ParseConfidence = "UNKNOWN";
    if (isVerifiedFormat(formatId)) {
      confidence = "VERIFIED";
    } else if (kind === "INI_TEXT" && document.measurementRecords.length > 0) {
      confidence = "PARTIAL";
    }

    return {
      text,
      document,
      descriptor: {
        formatId,
        label: this.buildLabel(kind, version),
        kind,
        version,
        versionFields,
        encoding,
        signature,
        recordCount: document.measurementRecords.length,
        metadataCount: document.metadata.length,
        evidence,
        confidence,
      },
    };
  }

  private buildFormatId(
    kind: AwpFormatDescriptor["kind"],
    version: string | undefined,
    document: AwpDocument,
  ): string {
    if (kind === "BINARY") return "awp-binary-unknown";
    if (kind === "UNKNOWN") return "awp-unknown";
    if (kind === "DELIMITED_TEXT") return "awp-delimited-unversioned";
    if (!version) {
      return document.measurementRecords.length > 0
        ? "contec-abpm50-ini-unversioned"
        : "awp-ini-no-records";
    }
    return `contec-abpm50-ini-v${version}`;
  }

  private buildLabel(kind: AwpFormatDescriptor["kind"], version?: string): string {
    if (kind === "BINARY") return "Binário não reconhecido";
    if (kind === "UNKNOWN") return "Estrutura não reconhecida";
    const suffix = version ? ` versão ${version}` : " sem versão declarada";
    return `Texto ${kind === "INI_TEXT" ? "chave=valor" : "delimitado"}${suffix}`;
  }
}
