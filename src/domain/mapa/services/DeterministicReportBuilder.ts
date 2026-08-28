import { guidelineFooter } from "../config/guideline";
import { interpretationDisplayText } from "../interpretation";
import type { PhraseCategory, RuleResult } from "../types/clinical";
import type { StructuredReportSections } from "../types/report";

type Resolved = RuleResult & { text: string };

function joinCategory(items: Resolved[], category: PhraseCategory): string {
  return items
    .filter((item) => item.category === category && item.code !== "GUIDELINE_FOOTER")
    .map((item) => item.text)
    .filter(Boolean)
    .join(
      category === "MEDICATION"
        ? "\n"
        : category === "CONCLUSION"
          ? "\n\n"
          : " ",
    );
}

export class DeterministicReportBuilder {
  constructor(private readonly footer: string = guidelineFooter) {}

  build(resolved: Resolved[]): StructuredReportSections {
    const general = joinCategory(resolved, "GENERAL_CONSIDERATION");
    const conclusion = joinCategory(resolved, "CONCLUSION");

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
      generalConsiderations: "Não informado.",
      conclusion:
        interpretationDisplayText(general, conclusion) || "Não informado.",
    };
  }

  guidelineText(): string {
    return this.footer;
  }
}
