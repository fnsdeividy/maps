import {
  AWP_FILE_EXTENSION,
  AWP_MAX_FILE_SIZE_BYTES,
} from "@/domain/mapa/import/awp/constants";
import { InvalidAwpFileError } from "@/domain/mapa/import/awp/errors";

/** Assinaturas de formatos que claramente não são exportações do aparelho. */
const REJECTED_SIGNATURES: Array<{ magic: number[]; label: string }> = [
  { magic: [0x25, 0x50, 0x44, 0x46], label: "PDF" },
  { magic: [0x50, 0x4b, 0x03, 0x04], label: "ZIP/Office" },
  { magic: [0x89, 0x50, 0x4e, 0x47], label: "PNG" },
  { magic: [0xff, 0xd8, 0xff], label: "JPEG" },
  { magic: [0x4d, 0x5a], label: "executável Windows" },
  { magic: [0x7f, 0x45, 0x4c, 0x46], label: "executável ELF" },
];

/**
 * Validação de servidor, independente do `accept` do input e do MIME type
 * informado pelo browser — ambos são controlados pelo cliente.
 */
export function assertAcceptableAwpUpload(input: {
  fileName: string;
  size: number;
  buffer: Buffer;
}) {
  if (!input.fileName.toLowerCase().endsWith(AWP_FILE_EXTENSION)) {
    throw new InvalidAwpFileError(
      "unexpected_extension",
      "Selecione o arquivo .AWP exportado pelo software do equipamento.",
    );
  }
  if (input.size === 0) {
    throw new InvalidAwpFileError("empty_file", "O arquivo enviado está vazio.");
  }
  if (input.size > AWP_MAX_FILE_SIZE_BYTES) {
    throw new InvalidAwpFileError(
      "file_too_large",
      "O arquivo é maior do que o esperado para um exame de MAPA.",
    );
  }

  for (const signature of REJECTED_SIGNATURES) {
    const matches = signature.magic.every(
      (byte, position) => input.buffer[position] === byte,
    );
    if (matches) {
      throw new InvalidAwpFileError(
        `rejected_signature_${signature.label}`,
        `O conteúdo enviado é um arquivo ${signature.label}, não uma exportação do CONTEC ABPM50.`,
      );
    }
  }
}
