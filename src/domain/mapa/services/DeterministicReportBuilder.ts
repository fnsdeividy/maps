import { guidelineFooter } from "../config/guideline";
import type { PhraseCategory, RuleResult } from "../types/clinical";
import type { StructuredReportSections } from "../types/report";

type Resolved = RuleResult & { text: string };

function joinCategory(items: Resolved[], category: PhraseCategory): string {
  return items
    .filter((item) => item.category === category && item.code !== "GUIDELINE_FOOTER")
    .map((item) => item.text)
    .filter(Boolean)
    .join(category === "MEDICATION" ? "\n" : " ");
}

export class DeterministicReportBuilder {
  constructor(private readonly footer: string = guidelineFooter) {}

  build(resolved: Resolved[]): StructuredReportSections {
    const general = joinCategory(resolved, "GENERAL_CONSIDERATION");

    return {
      medications: joinCategory(resolved, "MEDICATION") || "Não informado.",
      technicalComments:
        joinCategory(resolved, "TECHNICAL_QUALITY") || "Não informado.",
      averagePressure:
        joinCategory(resolved, "AVERAGE_PRESSURE") || "Não informado.",
      pressureLoad: joinCategory(resolved, "PRESSURE_LOAD") || "Não informado.",
      pressurePeaks:
        joinCategory(resolved, "PRESSURE_PEAK") || "Não informado.",
      nightDipping:
        joinCategory(resolved, "NIGHT_DIPPING") || "Não informado.",
      specialSituations:
        joinCategory(resolved, "SPECIAL_SITUATION") || "Não informado.",
      // A diretriz vai como Obs. na impressão, não misturada neste parágrafo.
      generalConsiderations: general || "Não informado.",
      conclusion: joinCategory(resolved, "CONCLUSION") || "Não informado.",
    };
  }

  guidelineText(): string {
    return this.footer;
  }
}
