import { describe, expect, it } from "vitest";
import { pickRewritableSections } from "@/services/ai/AiReportService";
import type { StructuredReportSections } from "@/domain/mapa/types/report";

const draft: StructuredReportSections = {
  medications: "Bisoprolol 2,5 mg",
  technicalComments: "Qualidade técnica adequada.",
  averagePressure: "Média 24h 127/70 mmHg.",
  pressureLoad: "Não informado.",
  pressurePeaks: "Não informado.",
  nightDipping: "Não informado.",
  specialSituations: "Não informado.",
  generalConsiderations: "Compatível com Normotensão Verdadeira.",
  conclusion: "MAPA dentro dos limites de normalidade.",
};

describe("pickRewritableSections", () => {
  it("omite medicamentos, conclusão e placeholders", () => {
    const picked = pickRewritableSections(draft);
    expect(picked).toEqual({
      technicalComments: "Qualidade técnica adequada.",
      averagePressure: "Média 24h 127/70 mmHg.",
      generalConsiderations: "Compatível com Normotensão Verdadeira.",
    });
    expect(picked).not.toHaveProperty("medications");
    expect(picked).not.toHaveProperty("conclusion");
  });
});
