import type { MapaFileParseResult } from "./awp/types";

/**
 * Contrato de leitura de arquivos exportados por equipamentos de MAPA.
 *
 * Substitui, para o fluxo de importação, o parser legado de
 * `src/parsers/mapa`, que só recebia o Buffer e devolvia campos agregados.
 * Aqui o resultado carrega as medições individuais e a rastreabilidade do
 * arquivo de origem.
 */
export interface MapaFileParser {
  canParse(file: Buffer, fileName: string): boolean;
  parse(file: Buffer, fileName: string): Promise<MapaFileParseResult>;
}
