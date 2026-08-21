import type { MapaFileParser, MapaParsedData } from "./MapaFileParser";

/**
 * Parser de demonstração. Não tenta inferir o layout do equipamento.
 * Retorna um objeto vazio para o médico completar o formulário.
 */
export class MockMapaFileParser implements MapaFileParser {
  async parse(_file: Buffer): Promise<MapaParsedData> {
    return {};
  }
}
