export class ClinicalConfigurationMissingError extends Error {
  constructor(
    public readonly parameterName: string,
    message = `Parâmetro clínico pendente de configuração médica: ${parameterName}`,
  ) {
    super(message);
    this.name = "ClinicalConfigurationMissingError";
  }
}
