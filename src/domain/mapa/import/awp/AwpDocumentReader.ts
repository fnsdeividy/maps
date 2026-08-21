import type { AwpDocument, AwpEntry } from "./types";

const SECTION_PATTERN = /^\[(.+)\]$/;
const COMMENT_PATTERN = /^[;#]/;
const RECORD_KEY_PATTERN = /^\d+$/;

/**
 * Lê a estrutura textual `Campo=Valor` / `1=...` do arquivo.
 *
 * Separa metadados, registros de medição, comentários e linhas não
 * reconhecidas. Nada é descartado: toda linha do arquivo cai em exatamente
 * uma dessas quatro listas.
 */
export function readAwpDocument(text: string): AwpDocument {
  const document: AwpDocument = {
    metadata: [],
    measurementRecords: [],
    comments: [],
    unknownFields: [],
    sections: [],
  };

  const lines = text.split(/\r\n|\n|\r/);
  let section: string | undefined;

  lines.forEach((rawLine, position) => {
    const line = rawLine.trim();
    const lineNumber = position + 1;

    if (line === "") return;

    if (COMMENT_PATTERN.test(line)) {
      document.comments.push({ line: lineNumber, text: line.slice(1).trim() });
      return;
    }

    const sectionMatch = SECTION_PATTERN.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      if (!document.sections.includes(section)) document.sections.push(section);
      return;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      document.unknownFields.push({ line: lineNumber, text: line });
      return;
    }

    const entry: AwpEntry = {
      key: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
      section,
      line: lineNumber,
    };

    if (RECORD_KEY_PATTERN.test(entry.key)) {
      document.measurementRecords.push(entry);
    } else {
      document.metadata.push(entry);
    }
  });

  return document;
}

export function metadataToRecord(document: AwpDocument): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of document.metadata) {
    const key = entry.section ? `${entry.section}.${entry.key}` : entry.key;
    result[key] = entry.value;
  }
  return result;
}

/** Todas as chaves de uma seção (comparação case-insensitive do nome da seção). */
export function metadataInSection(
  document: AwpDocument,
  sectionName: string,
): Record<string, string> {
  const wanted = sectionName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const result: Record<string, string> = {};
  for (const entry of document.metadata) {
    if (!entry.section) continue;
    const current = entry.section.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (current === wanted) result[entry.key] = entry.value;
  }
  return result;
}

/** Busca sem diferenciar maiúsculas, separadores ou seção. */
export function findMetadata(
  document: AwpDocument,
  candidates: string[],
): AwpEntry | undefined {
  const normalized = candidates.map((candidate) =>
    candidate.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  return document.metadata.find((entry) =>
    normalized.includes(entry.key.toLowerCase().replace(/[^a-z0-9]/g, "")),
  );
}
