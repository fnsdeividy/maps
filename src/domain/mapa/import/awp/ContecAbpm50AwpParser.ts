import { createHash } from "node:crypto";
import type { MapaFileParser } from "../MapaFileParser";
import { AwpFormatDetector } from "./AwpFormatDetector";
import { findMetadata, metadataInSection, metadataToRecord } from "./AwpDocumentReader";
import { AwpValidator } from "./AwpValidator";
import { readDeviceComments } from "./deviceComments";
import { readPatientData } from "./patientData";
import { readSleepWindow } from "./sleepWindow";
import {
  AWP_FILE_EXTENSION,
  AWP_MAX_FILE_SIZE_BYTES,
  CONTEC_ABPM50_MODEL,
  CONTEC_AWP_PARSER_VERSION,
  CONTEC_MANUFACTURER,
} from "./constants";
import {
  CorruptedAwpFileError,
  InvalidAwpFileError,
  NoMeasurementsFoundError,
} from "./errors";
import { buildDecoderChain } from "./decoders";
import { hexToBytes } from "./decoders/ContecAwpHexMeasurementDecoder";
import { findHexLayout } from "./decoders/hexLayouts";
import {
  buildDate,
  inferDateOrder,
  isDateToken,
  parseDateParts,
  readSectionLocalDateTime,
  type DateOrder,
} from "./decoders/dateTime";
import { normalizeFieldName, type AwpFieldName } from "./decoders/fields";
import type { AwpDecodeContext } from "./decoders/AwpMeasurementDecoder";
import type {
  AwpDocument,
  AwpRawRecord,
  MapaFileParseResult,
  MapaMeasurement,
  ParseConfidence,
  ParseWarning,
} from "./types";
import { toStoredDateTime } from "@/lib/dates";

const FIELD_ORDER_KEYS = ["DataFormat", "RecordFormat", "Fields", "Columns", "Format"];

const START_DATE_KEYS = [
  "StartDate",
  "BeginDate",
  "ExamDate",
  "TestDate",
  "RecordDate",
  "MeasureDate",
  "Date",
  "DataExame",
];

const CONFIDENCE_ORDER: Record<ParseConfidence, number> = {
  VERIFIED: 2,
  PARTIAL: 1,
  UNKNOWN: 0,
};

function lowestConfidence(a: ParseConfidence, b: ParseConfidence): ParseConfidence {
  return CONFIDENCE_ORDER[a] <= CONFIDENCE_ORDER[b] ? a : b;
}

/**
 * Leitor do arquivo .AWP exportado pelo CONTEC ABPM50.
 *
 * O pipeline é: detectar formato e codificação → ler a estrutura textual →
 * decodificar cada registro com o decoder mais explícito disponível → validar
 * estruturalmente. Nenhum valor clínico é estimado, completado ou corrigido em
 * qualquer etapa: registros que não podem ser lidos com certeza viram
 * UNDECODED_RECORD e ficam de fora dos cálculos.
 */
export class ContecAbpm50AwpParser implements MapaFileParser {
  constructor(
    private readonly detector = new AwpFormatDetector(),
    private readonly validator = new AwpValidator(),
    private readonly decoders = buildDecoderChain(),
  ) {}

  canParse(file: Buffer, fileName: string): boolean {
    if (!fileName.toLowerCase().endsWith(AWP_FILE_EXTENSION)) return false;
    if (file.length === 0 || file.length > AWP_MAX_FILE_SIZE_BYTES) return false;
    return true;
  }

  async parse(file: Buffer, fileName: string): Promise<MapaFileParseResult> {
    if (file.length === 0) {
      throw new InvalidAwpFileError("empty_file", "O arquivo enviado está vazio.");
    }
    if (file.length > AWP_MAX_FILE_SIZE_BYTES) {
      throw new InvalidAwpFileError(
        "file_too_large",
        "O arquivo é maior do que o esperado para um exame de MAPA.",
      );
    }
    if (!fileName.toLowerCase().endsWith(AWP_FILE_EXTENSION)) {
      throw new InvalidAwpFileError(
        "unexpected_extension",
        "Envie o arquivo .AWP exportado pelo software do equipamento.",
      );
    }

    const detection = this.detector.detect({ buffer: file, fileName });
    const { descriptor, document } = detection;
    const warnings: ParseWarning[] = [];

    if (descriptor.kind === "BINARY") {
      throw new CorruptedAwpFileError(
        "non_textual_content",
        "O conteúdo do arquivo não pôde ser lido como texto e não corresponde a nenhum layout conhecido.",
      );
    }
    if (descriptor.recordCount === 0) {
      throw new NoMeasurementsFoundError();
    }
    if (!descriptor.version) {
      warnings.push({
        code: "UNKNOWN_FILE_VERSION",
        message:
          "O arquivo não declara FileVersion_Main/FileVersion_Sub. O layout foi deduzido apenas pela estrutura do texto.",
      });
    }

    const context = this.buildContext(document, descriptor.formatId, warnings);
    const { measurements, rawRecords, decodeWarnings, confidence } = this.decodeRecords(
      document,
      context,
    );
    warnings.push(...decodeWarnings);

    if (context.fallbackDate && !context.recordsCarryOwnDate) {
      warnings.push({
        code: "DATE_FROM_FILE_START_DATE",
        message:
          "Os registros trazem apenas o horário. A data veio da data inicial declarada no arquivo, com virada de dia aplicada quando o horário retrocede na sequência.",
      });
      this.applyDayRollover(measurements, rawRecords);
    }

    if (measurements.length === 0) {
      throw new NoMeasurementsFoundError();
    }

    warnings.push(...this.validator.validateSequence(measurements));

    const sleep = readSleepWindow(document);
    warnings.push(...sleep.warnings);
    const patientData = readPatientData(document);

    const finalConfidence = lowestConfidence(descriptor.confidence, confidence);

    const timestamps = measurements.map((measurement) => measurement.measuredAt.getTime());
    const firstMeasurement = measurements.reduce((earliest, measurement) =>
      measurement.measuredAt.getTime() < earliest.measuredAt.getTime()
        ? measurement
        : earliest,
    );

    const deviceSetupParts = readSectionLocalDateTime(
      metadataInSection(document, "PATIENTDATA"),
    );
    const abpmStartParts = readSectionLocalDateTime(
      metadataInSection(document, "ABPMDATA"),
    );
    const deviceSetupStartedAt = deviceSetupParts
      ? buildDate(
          {
            year: deviceSetupParts.year,
            month: deviceSetupParts.month,
            day: deviceSetupParts.day,
          },
          {
            hour: deviceSetupParts.hour,
            minute: deviceSetupParts.minute,
            second: deviceSetupParts.second,
          },
        )
      : undefined;
    const abpmDeclaredStart = abpmStartParts
      ? buildDate(
          {
            year: abpmStartParts.year,
            month: abpmStartParts.month,
            day: abpmStartParts.day,
          },
          {
            hour: abpmStartParts.hour,
            minute: abpmStartParts.minute,
            second: abpmStartParts.second,
          },
        )
      : undefined;

    // Início das medições = primeira medição decodificada (não UTC, wall-clock).
    const measurementStartedAt = firstMeasurement.measuredAt ?? abpmDeclaredStart;

    return {
      manufacturer: CONTEC_MANUFACTURER,
      deviceModel: CONTEC_ABPM50_MODEL,
      detectedFormat: descriptor.formatId,
      detectedVersion: descriptor.version,
      parserVersion: CONTEC_AWP_PARSER_VERSION,
      confidence: finalConfidence,
      encoding: descriptor.encoding.encoding,
      metadata: metadataToRecord(document),
      examStart: new Date(Math.min(...timestamps)),
      examEnd: new Date(Math.max(...timestamps)),
      deviceSetupStartedAt,
      measurementStartedAt,
      measurements,
      rawRecords,
      comments: document.comments.map((comment) => comment.text),
      unknownFields: document.unknownFields.map((field) => field.text),
      patientData,
      schedule: sleep.schedule,
      sleepWindow: sleep.window,
      warnings,
      file: {
        originalName: fileName,
        size: file.length,
        sha256: createHash("sha256").update(file).digest("hex"),
      },
    };
  }

  private buildContext(
    document: AwpDocument,
    formatId: string,
    warnings: ParseWarning[],
  ): AwpDecodeContext {
    // Um token de data pode vir isolado ("13/09/2024") ou rotulado
    // ("Date:13/09/2024"); ambos são considerados na inferência da ordem.
    const dateTokens = document.measurementRecords
      .flatMap((record) => record.value.split(/[\s,;|\t]+/))
      .flatMap((token) => [token, ...token.split(/[:=]/)])
      .filter(isDateToken);
    const dateOrder = inferDateOrder(dateTokens);

    if (dateTokens.length > 0 && !dateOrder) {
      warnings.push({
        code: "AMBIGUOUS_DATE",
        message:
          "As datas do arquivo podem ser dia/mês ou mês/dia e nenhum registro permite decidir. Nenhuma data foi interpretada por suposição.",
      });
    }

    return {
      formatId,
      fieldOrder: this.readDeclaredFieldOrder(document, warnings),
      dateOrder,
      fallbackDate: this.readStartDate(document, dateOrder),
      recordsCarryOwnDate: dateTokens.length > 0,
      hexLayout: findHexLayout(formatId),
    };
  }

  /** Data inicial declarada em metadado, usada só por registros sem data própria. */
  private readStartDate(document: AwpDocument, dateOrder: DateOrder | undefined) {
    const entry = findMetadata(document, START_DATE_KEYS);
    if (!entry) return undefined;
    const token = entry.value.split(/\s+/).find(isDateToken);
    return token ? parseDateParts(token, dateOrder) : undefined;
  }

  /**
   * Exames de MAPA atravessam a meia-noite. Quando o registro só traz horário,
   * a virada de dia é reconstruída pela ordem cronológica da própria sequência
   * gravada pelo aparelho — não por estimativa de conteúdo clínico.
   */
  private applyDayRollover(measurements: MapaMeasurement[], rawRecords: AwpRawRecord[]) {
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    let extraDays = 0;
    let previousMinutes: number | undefined;

    for (const measurement of measurements) {
      const minutes =
        measurement.measuredAt.getUTCHours() * 60 +
        measurement.measuredAt.getUTCMinutes();
      if (previousMinutes !== undefined && minutes < previousMinutes) extraDays += 1;
      previousMinutes = minutes;

      if (extraDays > 0) {
        measurement.measuredAt = new Date(
          measurement.measuredAt.getTime() + extraDays * DAY_IN_MS,
        );
        const record = rawRecords.find((item) => item.index === measurement.index);
        if (record?.decoded) {
          record.decoded.measuredAt = toStoredDateTime(measurement.measuredAt);
        }
      }
    }
  }

  /** A ordem só é aceita quando declarada em metadado pelo próprio arquivo. */
  private readDeclaredFieldOrder(
    document: AwpDocument,
    warnings: ParseWarning[],
  ): AwpFieldName[] | undefined {
    const normalizedKeys = FIELD_ORDER_KEYS.map((key) => key.toLowerCase());
    const declaration = document.metadata.find((entry) =>
      normalizedKeys.includes(entry.key.toLowerCase().replace(/[^a-z0-9]/g, "")),
    );
    if (!declaration) return undefined;

    const labels = declaration.value.split(/[,;|\t]+/).map((label) => label.trim());
    const preferEnglishDia = labels.some((label) =>
      ["sys", "sbp", "systolic"].includes(label.toLowerCase().replace(/[^a-z0-9]/g, "")),
    );

    const order = labels.map((label) => {
      const field = normalizeFieldName(label, { preferEnglishDia });
      if (!field) {
        warnings.push({
          code: "UNKNOWN_FIELD",
          message: `Coluna declarada em ${declaration.key} não reconhecida: "${label}". Ela foi ignorada, não adivinhada.`,
        });
        return "ignored" as const;
      }
      return field;
    });

    return order.includes("systolic") && order.includes("diastolic") ? order : undefined;
  }

  private decodeRecords(document: AwpDocument, context: AwpDecodeContext) {
    const measurements: MapaMeasurement[] = [];
    const rawRecords: AwpRawRecord[] = [];
    const decodeWarnings: ParseWarning[] = [];
    const deviceComments = readDeviceComments(document);
    let confidence: ParseConfidence = "VERIFIED";
    let undecoded = 0;

    document.measurementRecords.forEach((entry, position) => {
      const index = Number(entry.key) || position + 1;
      const input = { index, key: entry.key, raw: entry.value, context };
      const decoder = this.decoders.find((candidate) => candidate.canDecode(input));

      if (!decoder) {
        decodeWarnings.push({
          code: "UNDECODED_RECORD",
          message: `Registro ${entry.key} não corresponde a nenhum layout conhecido e foi preservado sem interpretação.`,
          recordIndex: index,
        });
        rawRecords.push({
          index,
          key: entry.key,
          raw: entry.value,
          status: "UNDECODED",
          note: "nenhum decoder reconheceu o registro",
        });
        undecoded += 1;
        return;
      }

      const outcome = decoder.decode(input);
      decodeWarnings.push(...outcome.warnings);

      if (outcome.status === "UNDECODED") {
        rawRecords.push({
          index,
          key: entry.key,
          raw: entry.value,
          status: "UNDECODED",
          decoderId: decoder.id,
          bytes: outcome.bytes,
          note: outcome.note,
        });
        undecoded += 1;
        return;
      }

      const withComment = {
        ...outcome.measurement,
        deviceComment: deviceComments.get(index),
      };
      const validated = this.validator.validateMeasurement(withComment);
      decodeWarnings.push(...validated.warnings);
      measurements.push(validated.measurement);
      confidence = lowestConfidence(confidence, decoder.confidence);

      rawRecords.push({
        index,
        key: entry.key,
        raw: entry.value,
        status: validated.measurement.valid ? "DECODED" : "INVALID",
        decoderId: decoder.id,
        bytes:
          decoder.id === "contec-hex" || decoder.id === "contec-awp-v2"
            ? hexToBytes(entry.value)
            : undefined,
        decoded: {
          measuredAt: toStoredDateTime(validated.measurement.measuredAt),
          systolic: validated.measurement.systolic,
          diastolic: validated.measurement.diastolic,
          heartRate: validated.measurement.heartRate,
          meanArterialPressure: validated.measurement.meanArterialPressure,
          errorCode: validated.measurement.errorCode,
          rawTail: outcome.measurement.rawTail,
        },
        note: validated.measurement.invalidReason,
      });
    });

    // Registros isolados sem leitura são reportados como warning. Já quando a
    // maior parte do arquivo não é decodificável, o layout presumido está
    // errado e a confiança cai para UNKNOWN, bloqueando a importação.
    if (measurements.length === 0 || undecoded > measurements.length) {
      confidence = "UNKNOWN";
    }

    return { measurements, rawRecords, decodeWarnings, confidence };
  }
}
