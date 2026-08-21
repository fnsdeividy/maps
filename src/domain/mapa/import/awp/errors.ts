/**
 * Erros fatais da importação. Todos carregam uma mensagem em português já
 * pronta para a interface: nenhuma stack trace é exibida ao usuário final.
 */
export abstract class AwpImportError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
}

export class InvalidAwpFileError extends AwpImportError {
  readonly code = "INVALID_AWP_FILE";

  constructor(
    readonly reason: string,
    readonly userMessage = "O arquivo enviado não é um arquivo .AWP válido do equipamento.",
  ) {
    super(`invalid_awp_file: ${reason}`);
    this.name = "InvalidAwpFileError";
  }
}

export class UnsupportedAwpVersionError extends AwpImportError {
  readonly code = "UNSUPPORTED_AWP_VERSION";

  constructor(
    readonly detectedVersion: string | undefined,
    readonly userMessage = "A versão deste arquivo .AWP ainda não é suportada pelo sistema.",
  ) {
    super(`unsupported_awp_version: ${detectedVersion ?? "desconhecida"}`);
    this.name = "UnsupportedAwpVersionError";
  }
}

export class CorruptedAwpFileError extends AwpImportError {
  readonly code = "CORRUPTED_AWP_FILE";

  constructor(
    readonly reason: string,
    readonly userMessage = "O arquivo .AWP parece estar corrompido ou incompleto.",
  ) {
    super(`corrupted_awp_file: ${reason}`);
    this.name = "CorruptedAwpFileError";
  }
}

export class NoMeasurementsFoundError extends AwpImportError {
  readonly code = "NO_MEASUREMENTS_FOUND";

  constructor(
    readonly userMessage = "Nenhuma medição pôde ser lida deste arquivo. Ele não foi importado.",
  ) {
    super("no_measurements_found");
    this.name = "NoMeasurementsFoundError";
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AwpImportError) return error.userMessage;
  return "Não foi possível analisar o arquivo enviado.";
}
