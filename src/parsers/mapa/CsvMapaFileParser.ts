import { NotImplementedError } from "@/domain/mapa/errors/NotImplementedError";
import type { MapaFileParser, MapaParsedData } from "./MapaFileParser";

export class CsvMapaFileParser implements MapaFileParser {
  async parse(_file: Buffer): Promise<MapaParsedData> {
    throw new NotImplementedError("CsvMapaFileParser");
  }
}
