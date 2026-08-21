import OpenAI from "openai";
import type { AnonymizedAwpStructure } from "@/domain/mapa/import/awp/AwpAnonymizer";

export const AWP_AI_PROMPT_VERSION = "awp-structure-hypothesis-v1";

const SYSTEM_PROMPT = `Você auxilia engenheiros na engenharia reversa de um formato de arquivo proprietário de monitor de pressão arterial.

Você recebe apenas uma descrição estrutural anonimizada: nomes de campos, amostras de registros e tamanhos.

Você NÃO deve:
- afirmar valores de pressão arterial, frequência cardíaca, data ou hora;
- decodificar medições;
- propor offsets como se fossem confirmados;
- inventar informação que não esteja na estrutura recebida.

Você deve responder somente com hipóteses técnicas sobre o significado de campos e sobre como confirmá-las experimentalmente.

Responda em JSON:
{
  "hypotheses": [{ "target": string, "hypothesis": string, "howToConfirm": string, "confidence": "low" | "medium" | "high" }],
  "openQuestions": string[]
}`;

export interface AwpStructureHypothesis {
  target: string;
  hypothesis: string;
  howToConfirm: string;
  confidence: "low" | "medium" | "high";
}

export interface AwpStructureAnalysis {
  hypotheses: AwpStructureHypothesis[];
  openQuestions: string[];
  model: string;
}

/**
 * Camada auxiliar e opcional. Não participa do fluxo de leitura das medições:
 * é usada apenas no AWP Inspector, em desenvolvimento, para sugerir hipóteses
 * sobre campos desconhecidos. Nenhuma sugestão altera o parser — quem decide o
 * layout é o engenheiro, com evidência em múltiplos registros.
 */
export class AwpAiAssistant {
  constructor(
    private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  ) {}

  isAvailable(): boolean {
    return process.env.NODE_ENV === "development" && Boolean(process.env.OPENAI_API_KEY);
  }

  async suggestStructure(
    structure: AnonymizedAwpStructure,
  ): Promise<AwpStructureAnalysis> {
    if (!this.isAvailable()) {
      throw new Error("awp_ai_assistant_unavailable");
    }

    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(structure) },
        ],
      },
      { timeout: 25_000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("empty_ai_response");

    const parsed = JSON.parse(content) as Partial<AwpStructureAnalysis>;
    return {
      hypotheses: Array.isArray(parsed.hypotheses) ? parsed.hypotheses : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      model: response.model ?? this.model,
    };
  }
}
