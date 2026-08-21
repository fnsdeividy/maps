import type { StructuredReportSections } from "@/domain/mapa/types/report";
import type { AiMapaReportResponse } from "./schema";

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((item) => Number(item.replace(",", "."))).filter((n) => !Number.isNaN(n));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export class AiReportValidator {
  validate(
    draft: StructuredReportSections,
    ai: AiMapaReportResponse,
    medicationsSource: string,
  ): { ok: true } | { ok: false; reason: string } {
    const source = medicationsSource.trim().toLowerCase();
    const noMeds =
      !source ||
      source.includes("não há relato") ||
      source.includes("nao ha relato") ||
      normalize(draft.medications).includes("não há relato") ||
      normalize(draft.medications).includes("nao ha relato");
    if (noMeds && /\d+\s*mg/i.test(ai.medications)) {
      return { ok: false, reason: "invented_medication" };
    }

    const conclusionOk = normalize(ai.conclusion).includes(
      normalize(draft.conclusion),
    );
    if (!conclusionOk) {
      return { ok: false, reason: "conclusion_changed" };
    }

    const draftNumbers = extractNumbers(Object.values(draft).join(" "));
    const aiNumbers = extractNumbers(Object.values(ai).join(" "));
    const extra = aiNumbers.filter(
      (n) => !draftNumbers.some((d) => Math.abs(d - n) < 0.001),
    );
    if (extra.length > 0) {
      return { ok: false, reason: "unexpected_numbers" };
    }

    const missingCritical = extractNumbers(
      `${draft.averagePressure} ${draft.conclusion}`,
    ).filter((n) => !aiNumbers.some((a) => Math.abs(a - n) < 0.001));
    if (missingCritical.length > 0) {
      return { ok: false, reason: "missing_numbers" };
    }

    return { ok: true };
  }
}
