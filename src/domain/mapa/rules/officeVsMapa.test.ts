import { describe, expect, it } from "vitest";
import { classifyOfficeVsMapa } from "@/domain/mapa/rules/officeVsMapa";
import { MapaRuleEngine } from "@/domain/mapa/rules/MapaRuleEngine";
import {
  mapaThresholds,
  type MapaThresholds,
} from "@/domain/mapa/config/thresholds";

const officeThresholds = { systolic: 140, diastolic: 90 };

describe("office vs MAPA", () => {
  const mapa = mapaThresholds.full24Hours;

  it("consultório normal + MAPA normal", () => {
    expect(
      classifyOfficeVsMapa({
        officeSystolic: 120,
        officeDiastolic: 80,
        mapaSystolic: 120,
        mapaDiastolic: 70,
        officeThresholds,
        mapaThresholds: mapa,
      }),
    ).toBe("NORMOTENSION");
  });

  it("consultório elevado + MAPA normal", () => {
    expect(
      classifyOfficeVsMapa({
        officeSystolic: 150,
        officeDiastolic: 95,
        mapaSystolic: 120,
        mapaDiastolic: 70,
        officeThresholds,
        mapaThresholds: mapa,
      }),
    ).toBe("WHITE_COAT_HYPERTENSION");
  });

  it("consultório normal + MAPA elevado", () => {
    expect(
      classifyOfficeVsMapa({
        officeSystolic: 120,
        officeDiastolic: 80,
        mapaSystolic: 140,
        mapaDiastolic: 90,
        officeThresholds,
        mapaThresholds: mapa,
      }),
    ).toBe("MASKED_HYPERTENSION");
  });

  it("consultório elevado + MAPA 129,6 (exibido 130) não vira avental branco", () => {
    expect(
      classifyOfficeVsMapa({
        officeSystolic: 150,
        officeDiastolic: 95,
        mapaSystolic: 129.6,
        mapaDiastolic: 70,
        officeThresholds,
        mapaThresholds: mapa,
      }),
    ).toBe("SUSTAINED_HYPERTENSION");
  });

  it("consultório elevado + MAPA elevado", () => {
    expect(
      classifyOfficeVsMapa({
        officeSystolic: 150,
        officeDiastolic: 95,
        mapaSystolic: 140,
        mapaDiastolic: 90,
        officeThresholds,
        mapaThresholds: mapa,
      }),
    ).toBe("SUSTAINED_HYPERTENSION");
  });
});

describe("produção com limiares padrão do roteiro", () => {
  it("classifica avental branco com limiares padrão", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      officeSystolicPressure: 150,
      officeDiastolicPressure: 95,
      avg24hSystolic: 120,
      avg24hDiastolic: 70,
    });
    expect(results.some((item) => item.code === "OFFICE_VS_MAPA_WHITE_COAT")).toBe(
      true,
    );
    expect(results.some((item) => item.code === "CONCLUSION_WHITE_COAT")).toBe(
      true,
    );
  });

  it.each([
    {
      office: [150, 95] as const,
      mapa: [120, 70] as const,
      conclusion: "CONCLUSION_WHITE_COAT",
    },
    {
      office: [120, 80] as const,
      mapa: [140, 90] as const,
      conclusion: "CONCLUSION_MASKED",
    },
    {
      office: [150, 95] as const,
      mapa: [140, 90] as const,
      conclusion: "CONCLUSION_SUSTAINED",
    },
    {
      office: [120, 80] as const,
      mapa: [120, 70] as const,
      conclusion: "CONCLUSION_NORMOTENSION",
    },
  ])("interpretação recebe $conclusion", ({ office, mapa, conclusion }) => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "",
      officeSystolicPressure: office[0],
      officeDiastolicPressure: office[1],
      avg24hSystolic: mapa[0],
      avg24hDiastolic: mapa[1],
    });
    expect(results.some((item) => item.code === conclusion)).toBe(true);
  });

  it("não classifica office vs MAPA quando limiar de consultório é desativado", () => {
    const thresholds: MapaThresholds = {
      ...mapaThresholds,
      officeThresholds: null,
    };
    const engine = new MapaRuleEngine(thresholds);
    const results = engine.evaluate({
      currentMedications: "",
      officeSystolicPressure: 150,
      officeDiastolicPressure: 95,
      avg24hSystolic: 120,
      avg24hDiastolic: 70,
    });
    expect(results.some((item) => item.code === "OFFICE_VS_MAPA_WHITE_COAT")).toBe(
      false,
    );
    expect(results.some((item) => item.code === "GUIDELINE_FOOTER")).toBe(false);
  });

  it("com medicação cardiovascular e MAPA normal conclui hipertensão controlada", () => {
    const engine = new MapaRuleEngine();
    const results = engine.evaluate({
      currentMedications: "Losartana 50 mg",
      cvMedicationStatus: "YES",
      officeSystolicPressure: 120,
      officeDiastolicPressure: 80,
      avg24hSystolic: 120,
      avg24hDiastolic: 70,
    });
    expect(results.some((item) => item.code === "CONCLUSION_CONTROLLED")).toBe(
      true,
    );
    expect(
      results.some((item) => item.code === "OFFICE_VS_MAPA_CONTROLLED"),
    ).toBe(true);
    expect(results.some((item) => item.code === "CONCLUSION_NORMOTENSION")).toBe(
      false,
    );
  });
});
