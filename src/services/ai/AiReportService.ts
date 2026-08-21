import OpenAI from "openai";
import type { StructuredReportSections } from "@/domain/mapa/types/report";
import {
  aiMapaReportPartialSchema,
  type AiMapaReportPartial,
} from "./schema";

export const AI_PROMPT_VERSION = "mapa-rewrite-v2";

/** Seções que a IA pode polir. Medicamentos e conclusão ficam no rascunho. */
const REWRITABLE_KEYS = [
  "technicalComments",
  "averagePressure",
  "pressureLoad",
  "pressurePeaks",
  "nightDipping",
  "specialSituations",
  "generalConsiderations",
] as const;

type RewritableKey = (typeof REWRITABLE_KEYS)[number];

/** Chaves curtas no fio → menos tokens de entrada/saída. */
const SHORT_KEYS = {
  technicalComments: "t",
  averagePressure: "a",
  pressureLoad: "l",
  pressurePeaks: "p",
  nightDipping: "n",
  specialSituations: "s",
  generalConsiderations: "g",
} as const satisfies Record<RewritableKey, string>;

const LONG_KEYS = Object.fromEntries(
  Object.entries(SHORT_KEYS).map(([long, short]) => [short, long]),
) as Record<string, RewritableKey>;

const SYSTEM_PROMPT =
  "Reescreva trechos de laudo MAPA em português técnico e objetivo. " +
  "Não altere números, classificações nem invente dados. " +
  "Responda só JSON com as mesmas chaves curtas recebidas.";

function isPlaceholder(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return !normalized || normalized === "não informado." || normalized === "nao informado.";
}

/** Extrai só o que vale a pena reescrever (texto clínico real). */
export function pickRewritableSections(
  draft: StructuredReportSections,
): Partial<Record<RewritableKey, string>> {
  const picked: Partial<Record<RewritableKey, string>> = {};
  for (const key of REWRITABLE_KEYS) {
    const value = draft[key];
    if (!isPlaceholder(value)) picked[key] = value;
  }
  return picked;
}

function toShortPayload(
  sections: Partial<Record<RewritableKey, string>>,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(sections) as Array<
    [RewritableKey, string]
  >) {
    payload[SHORT_KEYS[key]] = value;
  }
  return payload;
}

function fromShortPayload(payload: Record<string, unknown>): AiMapaReportPartial {
  const expanded: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") continue;
    const longKey = LONG_KEYS[key] ?? (REWRITABLE_KEYS.includes(key as RewritableKey) ? key : null);
    if (longKey) expanded[longKey] = value;
  }
  return aiMapaReportPartialSchema.parse(expanded);
}

export type AiRewriteResult = {
  sections: StructuredReportSections;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** true quando não houve chamada à API (nada útil para reescrever). */
  skipped: boolean;
};

export class AiReportService {
  constructor(
    private readonly client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  ) {}

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async rewrite(draft: StructuredReportSections): Promise<AiRewriteResult> {
    const picked = pickRewritableSections(draft);
    if (Object.keys(picked).length === 0) {
      return {
        sections: draft,
        model: this.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        skipped: true,
      };
    }

    const shortPayload = toShortPayload(picked);
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        temperature: 0,
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(shortPayload) },
        ],
      },
      { timeout: 25_000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("empty_ai_response");
    }

    const rewritten = fromShortPayload(JSON.parse(content) as Record<string, unknown>);
    const usage = response.usage;

    return {
      sections: {
        ...draft,
        ...rewritten,
        // Sempre preservados — fora do escopo da IA.
        medications: draft.medications,
        conclusion: draft.conclusion,
      },
      model: response.model ?? this.model,
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      skipped: false,
    };
  }
}
