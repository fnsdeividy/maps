import { CONTEC_AWP_PARSER_VERSION } from "./constants";

export interface VerifiedAwpFormat {
  /** Versão do parser que produziu o resultado conferido. */
  parserVersion: string;
  /** Arquivo em tests/fixtures/contec-abpm50 usado como golden file. */
  fixture: string;
  /** Quem comparou o resultado com o software oficial CONTEC e quando. */
  verifiedBy: string;
  verifiedAt: string;
}

/**
 * Formatos cujo resultado já foi comparado, medição a medição, com o que o
 * software oficial da CONTEC apresenta para o mesmo arquivo.
 *
 * Enquanto um formato não estiver aqui, o parser é EXPERIMENTAL: a confiança
 * máxima é PARTIAL e o laudo nunca é criado automaticamente sem conferência
 * humana no preview.
 *
 * Para promover um formato a VERIFIED:
 *   1. coloque o .awp anonimizado em tests/fixtures/contec-abpm50/;
 *   2. crie o <nome>.expected.json com os números do software oficial;
 *   3. rode `npm test` e confirme que o golden file passa;
 *   4. registre o formatId aqui.
 */
export const VERIFIED_AWP_FORMATS: Record<string, VerifiedAwpFormat> = {};

export function isVerifiedFormat(formatId: string): boolean {
  const entry = VERIFIED_AWP_FORMATS[formatId];
  return entry?.parserVersion === CONTEC_AWP_PARSER_VERSION;
}
