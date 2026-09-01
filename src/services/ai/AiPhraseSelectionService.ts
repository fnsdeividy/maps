import OpenAI from "openai";
import type { PhraseCategory, RuleResult } from "@/domain/mapa/types/clinical";
import type { StructuredReportSections } from "@/domain/mapa/types/report";
import { composeInterpretationPhrases, phrasesOf } from "@/domain/mapa/interpretation";

export const AI_SELECTION_PROMPT_VERSION = "mapa-select-v4";

type Resolved = RuleResult & { text: string };

export type PhraseCandidate = { code: string; text: string };
export type CandidatesByCategory = Partial<Record<PhraseCategory, PhraseCandidate[]>>;

/** Seleção da IA por tópico: códigos escolhidos e/ou opinião livre. */
export type TopicSelection = { codes: string[]; opinion?: string };
export type SelectionByCategory = Partial<Record<PhraseCategory, TopicSelection>>;

/** Mapa tópico (seção) → categoria de frases. */
export const SECTION_CATEGORY: Record<
  keyof StructuredReportSections,
  PhraseCategory
> = {
  medications: "MEDICATION",
  technicalComments: "TECHNICAL_QUALITY",
  averagePressure: "AVERAGE_PRESSURE",
  pressureLoad: "PRESSURE_LOAD",
  pressurePeaks: "PRESSURE_PEAK",
  nightDipping: "NIGHT_DIPPING",
  specialSituations: "SPECIAL_SITUATION",
  generalConsiderations: "GENERAL_CONSIDERATION",
  conclusion: "CONCLUSION",
};

/**
 * Categorias em que a IA escolhe entre as frases — apenas as interpretativas.
 *
 * Tópicos factuais/numéricos (técnico, médias, cargas, picos, descenso) ficam
 * 100% determinísticos: as regras já selecionam as frases certas com os números,
 * e deixar a IA escolher um subconjunto poderia OMITIR linhas obrigatórias
 * (ex.: a média do Sono). Medicações são factuais e situações especiais só
 * entram quando declaradas, então também ficam fora da seleção da IA.
 */
export const AI_COMPOSED_CATEGORIES: PhraseCategory[] = ["CONCLUSION"];

/**
 * Categorias restritas ao que o motor já resolveu (nunca amplia pelo catálogo).
 * CONCLUSION entra aqui para a IA não escolher um diagnóstico concorrente do
 * catálogo; a interpretação já vem do motor (avental branco, mascarada, etc.).
 */
const ENGINE_ONLY_CATEGORIES = new Set<PhraseCategory>([
  "SPECIAL_SITUATION",
  "CONCLUSION",
]);

function hasUnresolvedPlaceholder(text: string): boolean {
  return /\{[a-zA-Z]+\}/.test(text);
}

/**
 * Monta os candidatos por categoria:
 * - Frases já resolvidas pelo motor (números corretos, situações declaradas).
 * - Mais frases do catálogo ativo SEM placeholders numéricos (seguras sem dados),
 *   exceto nas categorias restritas ao motor.
 */
export function buildCandidates(
  resolved: Resolved[],
  catalog: Array<{ code: string; category: string; text: string; active: boolean }>,
): CandidatesByCategory {
  const out: CandidatesByCategory = {};
  const seenByCategory = new Map<PhraseCategory, Set<string>>();

  const push = (category: PhraseCategory, candidate: PhraseCandidate) => {
    if (!out[category]) out[category] = [];
    if (!seenByCategory.has(category)) seenByCategory.set(category, new Set());
    const seen = seenByCategory.get(category)!;
    if (seen.has(candidate.code)) return;
    if (!candidate.text.trim()) return;
    seen.add(candidate.code);
    out[category]!.push(candidate);
  };

  for (const item of resolved) {
    if (item.code === "GUIDELINE_FOOTER") continue;
    if (item.code === "GENERAL_CONSIDER_CV_MEDS") continue;
    if (item.code.startsWith("OFFICE_VS_MAPA_")) continue;
    const category =
      item.category === "GENERAL_CONSIDERATION" ? "CONCLUSION" : item.category;
    push(category, { code: item.code, text: item.text });
  }

  for (const phrase of catalog) {
    if (!phrase.active) continue;
    if (phrase.code === "GUIDELINE_FOOTER") continue;
    if (phrase.code === "GENERAL_CONSIDER_CV_MEDS") continue;
    if (phrase.code.startsWith("OFFICE_VS_MAPA_")) continue;
    if (hasUnresolvedPlaceholder(phrase.text)) continue;

    if (phrase.category === "GENERAL_CONSIDERATION") {
      push("CONCLUSION", { code: phrase.code, text: phrase.text });
      continue;
    }

    const category = phrase.category as PhraseCategory;
    if (ENGINE_ONLY_CATEGORIES.has(category)) continue;
    if (!AI_COMPOSED_CATEGORIES.includes(category)) continue;
    push(category, { code: phrase.code, text: phrase.text });
  }

  return out;
}

/**
 * Constrói o texto final por tópico a partir da seleção da IA, sempre com
 * números vindos do texto já resolvido (candidato). Cai no determinístico
 * quando a IA não escolhe nada nem opina para o tópico.
 */
export function mergeSelection(
  candidates: CandidatesByCategory,
  selection: SelectionByCategory,
  deterministic: StructuredReportSections,
): StructuredReportSections {
  const result: StructuredReportSections = { ...deterministic };

  for (const key of Object.keys(SECTION_CATEGORY) as Array<
    keyof StructuredReportSections
  >) {
    const category = SECTION_CATEGORY[key];
    if (!AI_COMPOSED_CATEGORIES.includes(category)) continue;

    const picked = selection[category];
    if (!picked) continue;

    const byCode = new Map(
      (candidates[category] ?? []).map((c) => [c.code, c.text]),
    );
    const pickedCodes = (picked.codes ?? []).filter((code) => {
      if (code === "GENERAL_CONSIDER_CV_MEDS") return false;
      if (!code.startsWith("OFFICE_VS_MAPA_")) return true;
      return !(picked.codes ?? []).some((item) => item.startsWith("CONCLUSION_"));
    });
    const texts = pickedCodes
      .map((code) => byCode.get(code))
      .filter((text): text is string => Boolean(text?.trim()));

    if (texts.length > 0) {
      const merged =
        key === "conclusion"
          ? composeInterpretationPhrases(texts)
          : texts.join("\n\n");
      if (merged) result[key] = merged;
    } else if (picked.opinion?.trim()) {
      const opinion =
        key === "conclusion"
          ? composeInterpretationPhrases(phrasesOf(picked.opinion.trim()))
          : picked.opinion.trim();
      if (opinion) result[key] = opinion;
    }
  }

  return result;
}

export const SYSTEM_PROMPT =
  "Você seleciona frases padronizadas de laudo MAPA (aferição ambulatorial de PA). " +
  "Para cada tópico recebe uma lista de frases candidatas com id e texto. " +
  "Escolha os ids das frases que melhor se enquadram no tópico (1 ou mais). " +
  "Se nenhuma frase se enquadrar, deixe 'codes' vazio e escreva uma frase técnica e objetiva em 'opinion'. " +
  "Se o paciente usa medicação de efeito cardiovascular e as médias estão normais, " +
  "a interpretação é hipertensão controlada — nunca normotensão verdadeira. " +
  "Se usa essa medicação e o MAPA permanece elevado, a interpretação é hipertensão não controlada. " +
  "Use a medicação só na classificação; não escreva no laudo frases como " +
  "'considerar o uso de medicamentos de efeito cardiovascular'. " +
  "Não recalcule nenhuma métrica numérica. Utilize exatamente os valores fornecidos pelo sistema. " +
  "Não altere percentuais. Não estime valores. Não derive novas médias. " +
  "Não transforme valores baixos em altos ou vice-versa. " +
  "Sua função é redigir o laudo utilizando os indicadores calculados pelo sistema. " +
  "NUNCA invente números nem cite valores que não estejam nas frases ou no contexto fornecidos. " +
  "Se o contexto informar carga pressórica de 12,5%, o texto deve usar 12,5% — nunca outro percentual. " +
  "Não repita a mesma ideia: se já houver uma frase CONCLUSION_*, não escolha OFFICE_VS_MAPA_*. " +
  "Separe ideias distintas; o sistema já quebra em parágrafos. Responda apenas JSON no formato " +
  '{"<tópico>": {"codes": ["ID"], "opinion": ""}}.';

export type AiSelectionResult = {
  selection: SelectionByCategory;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  skipped: boolean;
};

const CATEGORY_BY_SECTION = SECTION_CATEGORY;

export class AiPhraseSelectionService {
  constructor(
    private readonly client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  ) {}

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async select(
    candidates: CandidatesByCategory,
    context: string,
  ): Promise<AiSelectionResult> {
    const topics: Record<string, PhraseCandidate[]> = {};
    for (const key of Object.keys(CATEGORY_BY_SECTION) as Array<
      keyof StructuredReportSections
    >) {
      const category = CATEGORY_BY_SECTION[key];
      if (!AI_COMPOSED_CATEGORIES.includes(category)) continue;
      const list = candidates[category] ?? [];
      if (list.length > 0) topics[key] = list;
    }

    if (Object.keys(topics).length === 0) {
      return this.empty(true);
    }

    const payload = {
      contexto: context,
      topicos: Object.fromEntries(
        Object.entries(topics).map(([key, list]) => [
          key,
          list.map((c) => ({ id: c.code, texto: c.text })),
        ]),
      ),
    };

    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
      },
      { timeout: 25_000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("empty_ai_response");

    const selection = parseSelection(JSON.parse(content) as Record<string, unknown>);
    const usage = response.usage;
    return {
      selection,
      model: response.model ?? this.model,
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      skipped: false,
    };
  }

  private empty(skipped: boolean): AiSelectionResult {
    return {
      selection: {},
      model: this.model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      skipped,
    };
  }
}

/** Converte o JSON da IA (chaveado por tópico) em seleção por categoria. */
export function parseSelection(
  raw: Record<string, unknown>,
): SelectionByCategory {
  const selection: SelectionByCategory = {};
  for (const key of Object.keys(CATEGORY_BY_SECTION) as Array<
    keyof StructuredReportSections
  >) {
    const category = CATEGORY_BY_SECTION[key];
    if (!AI_COMPOSED_CATEGORIES.includes(category)) continue;
    const entry = raw[key];
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { codes?: unknown; opinion?: unknown };
    const codes = Array.isArray(record.codes)
      ? record.codes.filter((c): c is string => typeof c === "string")
      : [];
    const opinion =
      typeof record.opinion === "string" ? record.opinion : undefined;
    selection[category] = { codes, opinion };
  }
  return selection;
}
