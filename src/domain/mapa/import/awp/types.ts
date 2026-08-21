import type { CONTEC_ABPM50_MODEL, CONTEC_MANUFACTURER } from "./constants";

/**
 * Grau de certeza sobre a decodificação.
 *
 * VERIFIED  layout conferido contra o resultado do software oficial CONTEC
 *           (exige fixture golden registrada em verifiedFormats.ts);
 * PARTIAL   o arquivo declara o significado dos campos lidos, mas o resultado
 *           ainda não foi comparado com o software oficial;
 * UNKNOWN   estrutura não reconhecida — importação bloqueada.
 */
export type ParseConfidence = "VERIFIED" | "PARTIAL" | "UNKNOWN";

export type ParseWarningCode =
  | "UNKNOWN_FILE_VERSION"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_LINE"
  | "INVALID_DATE"
  | "INVALID_MEASUREMENT_LENGTH"
  | "AMBIGUOUS_DATE"
  | "INVALID_MEASUREMENT"
  | "MISSING_HEART_RATE"
  | "UNDECODED_RECORD"
  | "MISSING_HEX_LAYOUT"
  | "DATE_FROM_FILE_START_DATE"
  | "SLEEP_WINDOW_NOT_FOUND"
  | "DUPLICATE_TIMESTAMP"
  | "NON_MONOTONIC_TIMESTAMPS";

export interface ParseWarning {
  code: ParseWarningCode | string;
  message: string;
  recordIndex?: number;
}

export interface MapaMeasurement {
  index: number;
  measuredAt: Date;
  systolic: number;
  diastolic: number;
  heartRate?: number;
  meanArterialPressure?: number;
  valid: boolean;
  errorCode?: string;
  rawRecord?: string;
  /** Comentário do equipamento associado ao registro (ex.: C13=Sem sinal). */
  deviceComment?: string;
  /** Motivo estrutural da invalidez, preferindo o comentário do aparelho. */
  invalidReason?: string;
  /** Observação clínica adicionada pelo médico na conferência. */
  observation?: string;
  /** Desconsiderada pelo revisor na conferência — não entra em médias nem gráficos. */
  discarded?: boolean;
}

export interface AwpPatientData {
  name?: string;
  patientId?: string;

  birthday?: Date;
  age?: number;

  /** Código bruto do arquivo (CONTEC: 0 = masculino, 1 = feminino). */
  genderCode?: number;

  heightCm?: number;
  weightKg?: number;

  race?: string;
  address?: string;
  phone?: string;
  email?: string;

  medications?: string;

  referringPhysician?: string;
  interpretingPhysician?: string;

  comments?: string;
  clinicalInterpretation?: string;

  outpatientNumber?: string;
  admissionNumber?: string;
  bedNumber?: string;
  departmentNumber?: string;
}

/** Horários programados no equipamento (não necessariamente o diário do paciente). */
export interface AwpSchedule {
  awakeStart: string;
  asleepStart: string;

  awakeMeasurementIntervalMinutes?: number;
  asleepMeasurementIntervalMinutes?: number;

  source: "DEVICE_CONFIGURATION";
}

export type AwpTextEncoding =
  | "utf-8"
  | "utf-16le"
  | "utf-16be"
  | "windows-1252"
  | "ascii"
  | "binary";

export interface EncodingDetection {
  encoding: AwpTextEncoding;
  hasBom: boolean;
  /** Falso quando o conteúdo tem densidade de bytes de controle típica de binário. */
  textual: boolean;
  evidence: string[];
}

export type AwpFileKind = "INI_TEXT" | "DELIMITED_TEXT" | "BINARY" | "UNKNOWN";

export interface AwpFormatDescriptor {
  formatId: string;
  label: string;
  kind: AwpFileKind;
  version?: string;
  versionFields: Record<string, string>;
  encoding: EncodingDetection;
  /** Primeiros bytes em hexadecimal, usados como assinatura do formato. */
  signature: string;
  recordCount: number;
  metadataCount: number;
  evidence: string[];
  confidence: ParseConfidence;
}

export type AwpRecordStatus = "DECODED" | "INVALID" | "UNDECODED";

/** Registro bruto preservado exatamente como veio do arquivo, para auditoria. */
export interface AwpRawRecord {
  index: number;
  key: string;
  raw: string;
  status: AwpRecordStatus;
  decoderId?: string;
  decoded?: {
    measuredAt?: string;
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    meanArterialPressure?: number;
    errorCode?: string;
    rawTail?: string;
  };
  /** Presente somente quando o registro é hexadecimal. */
  bytes?: number[];
  note?: string;
}

export interface AwpEntry {
  key: string;
  value: string;
  section?: string;
  line: number;
}

/** Saída bruta da leitura textual, antes de qualquer interpretação clínica. */
export interface AwpDocument {
  metadata: AwpEntry[];
  measurementRecords: AwpEntry[];
  comments: Array<{ line: number; text: string }>;
  unknownFields: Array<{ line: number; text: string }>;
  sections: string[];
}

export interface AwpSleepWindow {
  /** "HH:MM" no fuso do equipamento. */
  start: string;
  end: string;
  source: "FILE" | "MANUAL" | "DEVICE_CONFIGURATION";
  evidence?: string[];
}

export interface MapaFileParseResult {
  manufacturer: typeof CONTEC_MANUFACTURER;
  deviceModel: typeof CONTEC_ABPM50_MODEL;

  detectedFormat: string;
  detectedVersion?: string;

  parserVersion: string;
  confidence: ParseConfidence;
  encoding: AwpTextEncoding;

  metadata: Record<string, string>;

  examStart?: Date;
  examEnd?: Date;

  /**
   * Início da configuração do aparelho ([PATIENTDATA] YearBegin…).
   * Wall-clock do equipamento, sem timezone.
   */
  deviceSetupStartedAt?: Date;
  /**
   * Início das medições: primeira medição decodificada (preferencial) ou
   * [ABPMDATA] YearBegin… quando disponível.
   */
  measurementStartedAt?: Date;

  measurements: MapaMeasurement[];
  rawRecords: AwpRawRecord[];

  /** Nada é descartado em silêncio: comentários e linhas não interpretadas ficam aqui. */
  comments: string[];
  unknownFields: string[];

  patientData?: AwpPatientData;
  schedule?: AwpSchedule;
  sleepWindow?: AwpSleepWindow;

  warnings: ParseWarning[];

  file: {
    originalName: string;
    size: number;
    sha256: string;
  };
}
