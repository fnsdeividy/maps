/**
 * Versão do algoritmo de parsing. Precisa ser incrementada sempre que a
 * decodificação mudar, porque ela é gravada em cada importação e define
 * com qual lógica um exame antigo foi processado.
 */
export const CONTEC_AWP_PARSER_VERSION = "1.0.0";

export const AWP_FILE_EXTENSION = ".awp";

/** Arquivos de MAPA são pequenos; o limite evita upload acidental de outra coisa. */
export const AWP_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const CONTEC_MANUFACTURER = "CONTEC" as const;
export const CONTEC_ABPM50_MODEL = "ABPM50" as const;
