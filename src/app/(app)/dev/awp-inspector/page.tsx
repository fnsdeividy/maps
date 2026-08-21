import { notFound } from "next/navigation";
import { AwpAiAssistant } from "@/services/ai/AwpAiAssistant";
import { AwpInspectorClient } from "./AwpInspectorClient";

export default function AwpInspectorPage() {
  // Ferramenta interna de diagnóstico: não existe fora de desenvolvimento.
  if (process.env.NODE_ENV !== "development") notFound();

  const aiAvailable = new AwpAiAssistant().isAvailable();

  return (
    <div className="max-w-5xl">
      <div className="rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
        Ferramenta de desenvolvimento
      </div>
      <h1 className="mt-4 text-2xl font-semibold">AWP Inspector</h1>
      <p className="mt-1 text-sm text-slate-500">
        Inspeciona um arquivo do equipamento sem criar exame nem laudo. Serve para descobrir a
        estrutura de versões ainda não suportadas do .AWP.
      </p>
      <div className="mt-6">
        <AwpInspectorClient aiAvailable={aiAvailable} />
      </div>
    </div>
  );
}
