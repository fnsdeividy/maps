/**
 * Descrição estrutural mínima necessária para anonimizar. Aceita tanto um
 * `MapaFileParseResult` completo quanto a leitura parcial feita pelo Inspector
 * quando o arquivo não pôde ser decodificado.
 */
export interface AwpAnonymizerInput {
  detectedFormat: string;
  detectedVersion?: string;
  encoding: string;
  metadata: Record<string, string>;
  rawRecords: Array<{ key: string; raw: string; bytes?: number[] }>;
  unknownFields: string[];
  comments: string[];
  warnings: Array<{ code: string }>;
}

/** Chaves de metadados que podem carregar identificação do paciente. */
const PERSONAL_KEY = /(name|nome|patient|paciente|cpf|rg|doc|documento|id_?card|address|endereco|endereço|phone|fone|telefone|email|birth|nascimento|sexo|gender|responsavel|responsável|medico|médico|doctor|hospital|clinic)/i;

/** Padrões de dado pessoal que podem aparecer dentro de qualquer valor. */
const PERSONAL_VALUE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: "[CPF]" },
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: "[EMAIL]" },
  { pattern: /\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g, replacement: "[TELEFONE]" },
];

function scrubValue(value: string): string {
  return PERSONAL_VALUE_PATTERNS.reduce(
    (text, rule) => text.replace(rule.pattern, rule.replacement),
    value,
  );
}

export interface AnonymizedAwpStructure {
  detectedFormat: string;
  detectedVersion?: string;
  encoding: string;
  /** Só chaves e o formato do valor; nada de conteúdo identificável. */
  metadataShape: Array<{ key: string; valuePreview: string; length: number }>;
  redactedKeys: string[];
  recordSamples: Array<{ key: string; raw: string; bytes?: number[] }>;
  recordLengths: number[];
  unknownFields: string[];
  comments: string[];
  warningCodes: string[];
}

/**
 * Reduz o arquivo a uma descrição estrutural anonimizada, para que a análise
 * assistida por IA nunca receba nome, documento, contato ou o arquivo original.
 */
export function anonymizeForAnalysis(
  result: AwpAnonymizerInput,
  options: { sampleSize?: number } = {},
): AnonymizedAwpStructure {
  const sampleSize = options.sampleSize ?? 5;
  const metadataShape: AnonymizedAwpStructure["metadataShape"] = [];
  const redactedKeys: string[] = [];

  for (const [key, value] of Object.entries(result.metadata)) {
    if (PERSONAL_KEY.test(key)) {
      redactedKeys.push(key);
      continue;
    }
    metadataShape.push({
      key,
      valuePreview: scrubValue(value).slice(0, 32),
      length: value.length,
    });
  }

  return {
    detectedFormat: result.detectedFormat,
    detectedVersion: result.detectedVersion,
    encoding: result.encoding,
    metadataShape,
    redactedKeys,
    recordSamples: result.rawRecords.slice(0, sampleSize).map((record) => ({
      key: record.key,
      raw: scrubValue(record.raw).slice(0, 120),
      bytes: record.bytes?.slice(0, 24),
    })),
    recordLengths: [...new Set(result.rawRecords.map((record) => record.raw.length))],
    unknownFields: result.unknownFields.map((line) => scrubValue(line).slice(0, 120)),
    comments: result.comments.map((line) => scrubValue(line).slice(0, 120)),
    warningCodes: [...new Set(result.warnings.map((warning) => warning.code))],
  };
}
