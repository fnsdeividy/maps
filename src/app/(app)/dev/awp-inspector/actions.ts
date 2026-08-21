"use server";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { toUserMessage } from "@/domain/mapa/import/awp/errors";
import type { AnonymizedAwpStructure } from "@/domain/mapa/import/awp/AwpAnonymizer";
import { AwpAiAssistant, type AwpStructureAnalysis } from "@/services/ai/AwpAiAssistant";
import { inspectAwpBuffer, type AwpInspection } from "@/services/imports/awpInspector";

/** O Inspector é ferramenta de desenvolvimento e não existe em produção. */
function requireDevelopment() {
  if (process.env.NODE_ENV !== "development") notFound();
}

async function requireDoctor() {
  const session = await auth();
  if (!session?.user) redirect("/login");
}

export type InspectorState = {
  error?: string;
  inspection?: AwpInspection;
};

export async function inspectAwpFileAction(
  _state: InspectorState,
  formData: FormData,
): Promise<InspectorState> {
  requireDevelopment();
  await requireDoctor();

  const file = formData.get("awpFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo para inspecionar." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return { inspection: await inspectAwpBuffer(file.name, buffer) };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

export type AiHypothesisState = {
  error?: string;
  analysis?: AwpStructureAnalysis;
};

/**
 * Recebe apenas a estrutura já anonimizada montada pelo Inspector — nunca o
 * arquivo original. As hipóteses são exibidas como sugestão experimental e não
 * alteram o parser.
 */
export async function analyzeAwpStructureWithAiAction(
  _state: AiHypothesisState,
  formData: FormData,
): Promise<AiHypothesisState> {
  requireDevelopment();
  await requireDoctor();

  const payload = formData.get("structure");
  if (typeof payload !== "string" || payload.length === 0) {
    return { error: "Inspecione um arquivo antes de pedir hipóteses." };
  }

  const assistant = new AwpAiAssistant();
  if (!assistant.isAvailable()) {
    return {
      error:
        "Análise assistida indisponível: exige ambiente de desenvolvimento e OPENAI_API_KEY configurada.",
    };
  }

  try {
    const structure = JSON.parse(payload) as AnonymizedAwpStructure;
    return { analysis: await assistant.suggestStructure(structure) };
  } catch {
    return { error: "Não foi possível obter hipóteses para esta estrutura." };
  }
}
