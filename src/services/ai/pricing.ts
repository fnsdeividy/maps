/**
 * Preços por milhão de tokens. Atualize este arquivo quando a OpenAI
 * alterar a tabela oficial. Pode virar tabela Prisma no futuro.
 */
export type AiModelPricing = {
  model: string;
  inputPricePerMillionTokens: number;
  outputPricePerMillionTokens: number;
};

export const aiModelPricing: AiModelPricing[] = [
  {
    model: "gpt-4o-mini",
    inputPricePerMillionTokens: 0.15,
    outputPricePerMillionTokens: 0.6,
  },
  {
    model: "gpt-4o",
    inputPricePerMillionTokens: 2.5,
    outputPricePerMillionTokens: 10,
  },
];

export function getModelPricing(model: string): AiModelPricing {
  return (
    aiModelPricing.find((item) => item.model === model) ?? {
      model,
      inputPricePerMillionTokens: 0,
      outputPricePerMillionTokens: 0,
    }
  );
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
) {
  const pricing = getModelPricing(model);
  const estimatedInputCost =
    (inputTokens / 1_000_000) * pricing.inputPricePerMillionTokens;
  const estimatedOutputCost =
    (outputTokens / 1_000_000) * pricing.outputPricePerMillionTokens;
  return {
    estimatedInputCost,
    estimatedOutputCost,
    estimatedTotalCost: estimatedInputCost + estimatedOutputCost,
  };
}
