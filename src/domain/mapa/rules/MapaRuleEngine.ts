import {
  mapaThresholds,
  type MapaThresholds,
} from "../config/thresholds";
import type { MapaClinicalData, RuleResult } from "../types/clinical";
import {
  classifyAveragePressure,
  classifyAveragePressure24h,
} from "./averagePressure";
import { classifyOfficeVsMapa } from "./officeVsMapa";
import { classifyNightDip } from "./nightDipping";
import { isLoadElevated, roundPercent } from "./pressureLoad";
import { computeValidMeasurementsPercentage } from "./technicalQuality";

const AVG_24H_CODES: Record<string, string> = {
  BOTH_NORMAL: "AVG_24H_BOTH_NORMAL",
  BOTH_ELEVATED: "AVG_24H_BOTH_ELEVATED",
  BOTH_SIGNIFICANTLY_ELEVATED: "AVG_24H_BOTH_SIGNIFICANTLY_ELEVATED",
  SYS_ELEVATED: "AVG_24H_SYS_ELEVATED",
  SYS_SIGNIFICANTLY_ELEVATED: "AVG_24H_SYS_SIGNIFICANTLY_ELEVATED",
  DIA_ELEVATED: "AVG_24H_DIA_ELEVATED",
  DIA_SIGNIFICANTLY_ELEVATED: "AVG_24H_DIA_SIGNIFICANTLY_ELEVATED",
};

const AVG_PERIOD_CODES: Record<"awake" | "sleep", Record<string, string>> = {
  awake: {
    BOTH_NORMAL: "AVG_AWAKE_BOTH_NORMAL",
    SYS_ELEVATED: "AVG_AWAKE_SYS_ELEVATED",
    DIA_ELEVATED: "AVG_AWAKE_DIA_ELEVATED",
    BOTH_ELEVATED: "AVG_AWAKE_BOTH_ELEVATED",
  },
  sleep: {
    BOTH_NORMAL: "AVG_SLEEP_BOTH_NORMAL",
    SYS_ELEVATED: "AVG_SLEEP_SYS_ELEVATED",
    DIA_ELEVATED: "AVG_SLEEP_DIA_ELEVATED",
    BOTH_ELEVATED: "AVG_SLEEP_BOTH_ELEVATED",
  },
};

const OFFICE_VS_MAPA_CODES = {
  NORMOTENSION: "OFFICE_VS_MAPA_NORMOTENSION",
  SUSTAINED_HYPERTENSION: "OFFICE_VS_MAPA_SUSTAINED",
  WHITE_COAT_HYPERTENSION: "OFFICE_VS_MAPA_WHITE_COAT",
  MASKED_HYPERTENSION: "OFFICE_VS_MAPA_MASKED",
} as const;

const CONCLUSION_CODES = {
  NORMOTENSION: "CONCLUSION_NORMOTENSION",
  SUSTAINED_HYPERTENSION: "CONCLUSION_SUSTAINED",
  WHITE_COAT_HYPERTENSION: "CONCLUSION_WHITE_COAT",
  MASKED_HYPERTENSION: "CONCLUSION_MASKED",
} as const;

export class MapaRuleEngine {
  constructor(private readonly thresholds: MapaThresholds = mapaThresholds) {}

  evaluate(data: MapaClinicalData): RuleResult[] {
    return [
      ...this.evaluateMedications(data),
      ...this.evaluateTechnicalQuality(data),
      ...this.evaluateAveragePressures(data),
      ...this.evaluatePressureLoad(data),
      ...this.evaluatePressurePeaks(data),
      ...this.evaluateNightDipping(data),
      ...this.evaluateSpecialSituations(data),
      ...this.evaluateOfficeVsMapa(data),
    ];
  }

  private evaluateMedications(data: MapaClinicalData): RuleResult[] {
    const results: RuleResult[] = [];
    const meds = data.currentMedications?.trim();

    if (!meds) {
      results.push({
        code: "MED_NONE",
        category: "MEDICATION",
        status: "OK",
        message: "Não há relato de uso de medicações durante o exame.",
      });
    } else {
      results.push({
        code: "MED_CUSTOM",
        category: "MEDICATION",
        status: "OK",
        message: meds,
      });
    }

    if (data.pregnancyStatus === "YES" || data.pregnancy) {
      results.push({
        code: "MED_PREGNANCY",
        category: "MEDICATION",
        status: "OK",
        message: data.pregnancyMonths
          ? `Gestante de ${data.pregnancyMonths} meses.`
          : "Gestante.",
        values: data.pregnancyMonths
          ? { months: data.pregnancyMonths }
          : undefined,
      });
    }

    const officeSys =
      data.officeSystolicPressure != null
        ? String(data.officeSystolicPressure)
        : "—";
    const officeDia =
      data.officeDiastolicPressure != null
        ? String(data.officeDiastolicPressure)
        : "—";
    const hrLabel =
      data.officeHeartRate != null ? String(data.officeHeartRate) : "—";
    results.push({
      code: "MED_OFFICE_BP",
      category: "MEDICATION",
      status: "OK",
      message: `PA de Consultório: BE sentado: ${officeSys}/${officeDia} mmHg. FC: ${hrLabel}.`,
      values: {
        officeSystolic: data.officeSystolicPressure ?? Number.NaN,
        officeDiastolic: data.officeDiastolicPressure ?? Number.NaN,
        officeHeartRate: data.officeHeartRate ?? Number.NaN,
      },
    });

    return results;
  }

  private evaluateTechnicalQuality(data: MapaClinicalData): RuleResult[] {
    if (data.totalMeasurements == null || data.validMeasurements == null) {
      return [];
    }

    const percentage = computeValidMeasurementsPercentage(
      data.validMeasurements,
      data.totalMeasurements,
    );
    if (percentage == null) return [];

    const rounded = roundPercent(percentage);
    const minValid =
      this.thresholds.technicalQualityThresholds?.minValidPercentage ?? 70;

    if (rounded >= minValid) {
      return [
        {
          code: "TECH_SATISFACTORY",
          category: "TECHNICAL_QUALITY",
          status: "OK",
          message: `Procedimento de qualidade técnica satisfatória. Foram obtidas ${data.validMeasurements} medições válidas nas 24 horas de exame, representando ${rounded}% do total de medidas.`,
          values: {
            validMeasurements: data.validMeasurements,
            validPercentage: rounded,
            totalMeasurements: data.totalMeasurements,
          },
        },
      ];
    }

    return [
      {
        code: "TECH_COMPROMISED",
        category: "TECHNICAL_QUALITY",
        status: "OK",
        message: `Procedimento de qualidade técnica comprometida devido ao número total de medições válidas (${data.validMeasurements}) estar abaixo do limite para validação do método.`,
        values: {
          validMeasurements: data.validMeasurements,
          validPercentage: rounded,
          totalMeasurements: data.totalMeasurements,
        },
      },
      {
        code: "TECH_BELOW_RECOMMENDED",
        category: "TECHNICAL_QUALITY",
        status: "OK",
        message:
          "Qualidade técnica abaixo do recomendável para a interpretação satisfatória dos dados.",
      },
      {
        code: "TECH_SUGGEST_REPEAT",
        category: "TECHNICAL_QUALITY",
        status: "OK",
        message: "Sugerimos repetição do exame.",
      },
    ];
  }

  private evaluateAveragePressures(data: MapaClinicalData): RuleResult[] {
    const results: RuleResult[] = [];

    if (data.avg24hSystolic != null && data.avg24hDiastolic != null) {
      const klass = classifyAveragePressure24h(
        data.avg24hSystolic,
        data.avg24hDiastolic,
        this.thresholds.full24Hours,
        this.thresholds.significantlyElevatedThresholds,
      );
      results.push({
        code: AVG_24H_CODES[klass],
        category: "AVERAGE_PRESSURE",
        status: "OK",
        message: `24h:${klass}`,
        values: {
          systolic: data.avg24hSystolic,
          diastolic: data.avg24hDiastolic,
        },
      });
    }

    for (const period of ["awake", "sleep"] as const) {
      const systolic =
        period === "awake" ? data.awakeSystolic : data.sleepSystolic;
      const diastolic =
        period === "awake" ? data.awakeDiastolic : data.sleepDiastolic;
      if (systolic == null || diastolic == null) continue;

      const klass = classifyAveragePressure(
        systolic,
        diastolic,
        this.thresholds[period],
      );
      results.push({
        code: AVG_PERIOD_CODES[period][klass],
        category: "AVERAGE_PRESSURE",
        status: "OK",
        message: `${period}:${klass}`,
        values: { systolic, diastolic },
      });

      if (klass === "SYS_ELEVATED") {
        results.push({
          code: period === "awake" ? "AVG_AWAKE_DIA_NORMAL" : "AVG_SLEEP_DIA_NORMAL",
          category: "AVERAGE_PRESSURE",
          status: "OK",
          message: `${period}:dia_normal`,
        });
      }
      if (klass === "DIA_ELEVATED") {
        results.push({
          code: period === "awake" ? "AVG_AWAKE_SYS_NORMAL" : "AVG_SLEEP_SYS_NORMAL",
          category: "AVERAGE_PRESSURE",
          status: "OK",
          message: `${period}:sys_normal`,
        });
      }
    }

    return results;
  }

  private evaluatePressureLoad(data: MapaClinicalData): RuleResult[] {
    const elevatedCut =
      this.thresholds.pressureLoadThresholds?.elevatedPercent ?? 25;

    const awakeSys = data.awakeSystolicLoad;
    const awakeDia = data.awakeDiastolicLoad;
    const sleepSys = data.sleepSystolicLoad;
    const sleepDia = data.sleepDiastolicLoad;

    const hasAny =
      awakeSys != null || awakeDia != null || sleepSys != null || sleepDia != null;
    if (!hasAny) return [];

    const awakeSysElev = isLoadElevated(awakeSys, elevatedCut);
    const awakeDiaElev = isLoadElevated(awakeDia, elevatedCut);
    const sleepSysElev = isLoadElevated(sleepSys, elevatedCut);
    const sleepDiaElev = isLoadElevated(sleepDia, elevatedCut);

    const present = [
      awakeSys != null,
      awakeDia != null,
      sleepSys != null,
      sleepDia != null,
    ];
    const elevated = [awakeSysElev, awakeDiaElev, sleepSysElev, sleepDiaElev];
    const anyElevated = elevated.some(Boolean);
    const allPresentNormal =
      present.every((isPresent, index) => !isPresent || !elevated[index]) &&
      present.some(Boolean);

    if (allPresentNormal && !anyElevated) {
      const bothPeriods =
        awakeSys != null &&
        awakeDia != null &&
        sleepSys != null &&
        sleepDia != null;
      if (bothPeriods) {
        return [
          {
            code: "LOAD_BOTH_PERIODS_NORMAL",
            category: "PRESSURE_LOAD",
            status: "OK",
            message: "Cargas pressóricas na Vigília e no Sono normais.",
          },
        ];
      }
    }

    const results: RuleResult[] = [];

    if (awakeSysElev && awakeSys != null) {
      results.push({
        code: "LOAD_AWAKE_SYS_ELEVATED",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: `Carga pressórica sistólica elevada na Vigília (${roundPercent(awakeSys)}%).`,
        values: { percent: roundPercent(awakeSys) },
      });
    }
    if (awakeDiaElev && awakeDia != null) {
      results.push({
        code: "LOAD_AWAKE_DIA_ELEVATED",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: `Carga pressórica diastólica elevada na Vigília (${roundPercent(awakeDia)}%).`,
        values: { percent: roundPercent(awakeDia) },
      });
    }
    if (sleepSysElev && sleepSys != null) {
      results.push({
        code: "LOAD_SLEEP_SYS_ELEVATED",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: `Carga pressórica sistólica elevada no Sono (${roundPercent(sleepSys)}%).`,
        values: { percent: roundPercent(sleepSys) },
      });
    }
    if (sleepDiaElev && sleepDia != null) {
      results.push({
        code: "LOAD_SLEEP_DIA_ELEVATED",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: `Carga pressórica diastólica elevada no Sono (${roundPercent(sleepDia)}%).`,
        values: { percent: roundPercent(sleepDia) },
      });
    }

    if (
      awakeSys != null &&
      awakeDia != null &&
      !awakeSysElev &&
      !awakeDiaElev &&
      anyElevated
    ) {
      results.push({
        code: "LOAD_AWAKE_BOTH_NORMAL",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: "Cargas pressóricas sistólica e diastólica normais na Vigília.",
      });
    }

    if (
      sleepSys != null &&
      sleepDia != null &&
      !sleepSysElev &&
      !sleepDiaElev &&
      anyElevated
    ) {
      results.push({
        code: "LOAD_SLEEP_BOTH_NORMAL",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: "Cargas pressóricas sistólica e diastólica normais no Sono.",
      });
    }

    if (
      awakeSys != null &&
      sleepSys != null &&
      !awakeSysElev &&
      !sleepSysElev &&
      anyElevated
    ) {
      results.push({
        code: "LOAD_SYS_BOTH_NORMAL",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: "Cargas pressóricas sistólicas normais na Vigília e no Sono.",
      });
    }

    if (
      awakeDia != null &&
      sleepDia != null &&
      !awakeDiaElev &&
      !sleepDiaElev &&
      anyElevated
    ) {
      results.push({
        code: "LOAD_DIA_BOTH_NORMAL",
        category: "PRESSURE_LOAD",
        status: "OK",
        message: "Cargas pressóricas diastólicas normais na Vigília e no Sono.",
      });
    }

    if (results.length === 0 && allPresentNormal) {
      return [
        {
          code: "LOAD_BOTH_PERIODS_NORMAL",
          category: "PRESSURE_LOAD",
          status: "OK",
          message: "Cargas pressóricas na Vigília e no Sono normais.",
        },
      ];
    }

    return results;
  }

  private evaluatePressurePeaks(data: MapaClinicalData): RuleResult[] {
    const results: RuleResult[] = [];

    if (data.peakAwake && data.peakSleep) {
      results.push({
        code: "PEAK_AWAKE_AND_SLEEP",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: "Picos pressóricos durante a Vigília e o Sono.",
      });
    } else if (data.peakAwake) {
      results.push({
        code: "PEAK_AWAKE",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: "Pico pressórico durante a Vigília.",
      });
    } else if (data.peakSleep) {
      results.push({
        code: "PEAK_SLEEP",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: "Pico pressórico durante o Sono.",
      });
    }

    if (data.peakWithHeartRateIncrease) {
      results.push({
        code: "PEAK_HR",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: "Concomitante aumento da frequência cardíaca.",
      });
    }
    if (data.peakPhysicalEmotionalStress) {
      results.push({
        code: "PEAK_STRESS",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: "Relato de estresse físico-emocional neste momento.",
      });
    }
    if (data.peakMorning) {
      results.push({
        code: "PEAK_MORNING",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: "Pico pressórico matutino, ao acordar.",
      });
    }
    if (data.peakPressureNotes?.trim()) {
      results.push({
        code: "PEAK_NOTES",
        category: "PRESSURE_PEAK",
        status: "OK",
        message: data.peakPressureNotes.trim(),
      });
    }

    return results;
  }

  private evaluateNightDipping(data: MapaClinicalData): RuleResult[] {
    const thresholds = this.thresholds.nightDippingThresholds;
    if (!thresholds) return [];

    const sys = data.systolicNightDipping;
    const dia = data.diastolicNightDipping;
    if (sys == null && dia == null) return [];

    const sysClass = sys != null ? classifyNightDip(sys, thresholds) : null;
    const diaClass = dia != null ? classifyNightDip(dia, thresholds) : null;

    if (sysClass === "ABSENT" || diaClass === "ABSENT") {
      return [
        {
          code: "DIP_ABSENT",
          category: "NIGHT_DIPPING",
          status: "OK",
          message: "Ausência de descenso pressórico noturno.",
          values: {
            ...(sys != null ? { systolicNightDipping: roundPercent(sys) } : {}),
            ...(dia != null ? { diastolicNightDipping: roundPercent(dia) } : {}),
          },
        },
      ];
    }

    if (sysClass === "NORMAL" && diaClass === "NORMAL") {
      return [
        {
          code: "DIP_BOTH_NORMAL",
          category: "NIGHT_DIPPING",
          status: "OK",
          message: "Descensos pressóricos sistólico e diastólico normais.",
        },
      ];
    }

    if (sysClass === "ACCENTUATED" && diaClass === "ACCENTUATED" && sys != null && dia != null) {
      return [
        {
          code: "DIP_BOTH_ACCENTUATED",
          category: "NIGHT_DIPPING",
          status: "OK",
          message: `Descenso sistólico e diastólico acentuados (${roundPercent(sys)}% / ${roundPercent(dia)}%).`,
          values: {
            systolicPercent: roundPercent(sys),
            diastolicPercent: roundPercent(dia),
          },
        },
      ];
    }

    const results: RuleResult[] = [];

    if (sysClass === "ATTENUATED" && sys != null) {
      results.push({
        code: "DIP_SYS_ATTENUATED",
        category: "NIGHT_DIPPING",
        status: "OK",
        message: `Descenso sistólico atenuado (${roundPercent(sys)}%).`,
        values: { percent: roundPercent(sys) },
      });
    }
    if (diaClass === "ATTENUATED" && dia != null) {
      results.push({
        code: "DIP_DIA_ATTENUATED",
        category: "NIGHT_DIPPING",
        status: "OK",
        message: `Descenso diastólico atenuado (${roundPercent(dia)}%).`,
        values: { percent: roundPercent(dia) },
      });
    }
    if (sysClass === "ACCENTUATED" && sys != null) {
      results.push({
        code: "DIP_SYS_ACCENTUATED",
        category: "NIGHT_DIPPING",
        status: "OK",
        message: `Descenso sistólico acentuado (${roundPercent(sys)}%).`,
        values: { percent: roundPercent(sys) },
      });
    }
    if (diaClass === "ACCENTUATED" && dia != null) {
      results.push({
        code: "DIP_DIA_ACCENTUATED",
        category: "NIGHT_DIPPING",
        status: "OK",
        message: `Descenso diastólico acentuado (${roundPercent(dia)}%).`,
        values: { percent: roundPercent(dia) },
      });
    }

    if (results.length === 0 && sysClass === "NORMAL" && diaClass == null) {
      return [
        {
          code: "DIP_BOTH_NORMAL",
          category: "NIGHT_DIPPING",
          status: "OK",
          message: "Descensos pressóricos sistólico e diastólico normais.",
        },
      ];
    }

    return results;
  }

  private evaluateSpecialSituations(data: MapaClinicalData): RuleResult[] {
    const codes = new Set(data.specialSituations ?? []);
    const pregnancyYes =
      data.pregnancyStatus === "YES" || Boolean(data.pregnancy);
    if (pregnancyYes) codes.add("PREGNANT");
    if (data.alcoholUse === "YES") codes.add("ALCOHOL");
    if (data.smoking === "YES") codes.add("SMOKING");
    if (data.insomnia === "YES") codes.add("INSOMNIA");
    if (data.caffeineUse === "YES") codes.add("CAFFEINE");

    const map: Record<string, { code: string; message: string }> = {
      PREGNANT: {
        code: "SPECIAL_PREGNANT",
        message:
          "Considerar os valores mensurados em exame realizado em gestante.",
      },
      ALCOHOL: {
        code: "SPECIAL_ALCOHOL",
        message: "Relato de uso de bebidas alcoólicas.",
      },
      SMOKING: {
        code: "SPECIAL_SMOKING",
        message: "Relato de tabagismo.",
      },
      INSOMNIA: {
        code: "SPECIAL_INSOMNIA",
        message: "Relato de insônia.",
      },
      CAFFEINE: {
        code: "SPECIAL_CAFFEINE",
        message: "Relato de uso de cafeína.",
      },
      ORTHOSTATIC: {
        code: "SPECIAL_ORTHOSTATIC",
        message: "Redução pressórica ortostática.",
      },
      NAP: {
        code: "SPECIAL_NAP",
        message: "Redução pressórica associada à sesta.",
      },
      POSTPRANDIAL: {
        code: "SPECIAL_POSTPRANDIAL",
        message: "Redução pressórica pós-prandial.",
      },
      BISOPROLOL: {
        code: "SPECIAL_BISOPROLOL",
        message:
          "Valores pressóricos em consultório normais, na vigência de Bisoprolol 2,5mg/24h (SIC).",
      },
      OFFICE_HIGH_BP: {
        code: "SPECIAL_OFFICE_HIGH",
        message:
          "Pressão Arterial sistólica e/ou diastólica, no consultório, elevada.",
      },
    };

    // Só situações declaradas (Sim) ou marcadas manualmente entram no laudo;
    // respostas "não"/"não informado" não geram texto.
    const results: RuleResult[] = [...codes]
      .filter((key) => map[key])
      .map((key) => ({
        code: map[key].code,
        category: "SPECIAL_SITUATION" as const,
        status: "OK" as const,
        message: map[key].message,
      }));

    if (codes.has("NAP")) {
      results.push({
        code: "GENERAL_NAP_PHYSIOLOGIC",
        category: "GENERAL_CONSIDERATION",
        status: "OK",
        message:
          "Observamos comportamento fisiológico da Pressão Arterial, relacionada ao período de sesta (sono durante o dia).",
      });
    }

    return results;
  }

  private evaluateOfficeVsMapa(data: MapaClinicalData): RuleResult[] {
    const hasOffice =
      data.officeSystolicPressure != null &&
      data.officeDiastolicPressure != null;
    const hasMapa =
      data.avg24hSystolic != null && data.avg24hDiastolic != null;

    if (!hasOffice || !hasMapa || !this.thresholds.officeThresholds) {
      const pending: RuleResult[] = [];
      if (!hasOffice && hasMapa) {
        pending.push({
          code: "CONCLUSION_MISSING_OFFICE",
          category: "CONCLUSION",
          status: "OK",
          message:
            "A conclusão consultório × MAPA depende da PA de consultório, que não foi informada neste exame.",
        });
      }
      return pending;
    }

    const classification = classifyOfficeVsMapa({
      officeSystolic: data.officeSystolicPressure!,
      officeDiastolic: data.officeDiastolicPressure!,
      mapaSystolic: data.avg24hSystolic!,
      mapaDiastolic: data.avg24hDiastolic!,
      officeThresholds: this.thresholds.officeThresholds,
      mapaThresholds: this.thresholds.full24Hours,
    });

    const results: RuleResult[] = [
      {
        code: OFFICE_VS_MAPA_CODES[classification],
        category: "GENERAL_CONSIDERATION",
        status: "OK",
        message: classification,
      },
    ];

    const awakeSysElevated =
      data.awakeSystolic != null &&
      data.awakeSystolic >= this.thresholds.awake.systolic;

    const dippingAbnormal = this.hasAbnormalNightDipping(data);

    // Interpretação sempre recebe a conclusão diagnóstica. Em normotensão com
    // achado extra (vigília/descenso), a frase mais específica substitui a
    // genérica para não contradizer “verdadeira” com “porém alterado”.
    if (classification === "NORMOTENSION" && awakeSysElevated) {
      results.push({
        code: "CONCLUSION_NORMOTENSION_ALTERED_AWAKE_SYS",
        category: "CONCLUSION",
        status: "OK",
        message: "CONCLUSION_NORMOTENSION_ALTERED_AWAKE_SYS",
      });
    } else if (classification === "NORMOTENSION" && dippingAbnormal) {
      results.push({
        code: "CONCLUSION_NORMOTENSION_ALTERED_DIPPING",
        category: "CONCLUSION",
        status: "OK",
        message: "CONCLUSION_NORMOTENSION_ALTERED_DIPPING",
      });
    } else {
      results.push({
        code: CONCLUSION_CODES[classification],
        category: "CONCLUSION",
        status: "OK",
        message: classification,
      });
    }

    if (data.peakPhysicalEmotionalStress) {
      results.push({
        code: "CONCLUSION_CONSIDER_STRESS_OR_MEDS",
        category: "CONCLUSION",
        status: "OK",
        message: "CONCLUSION_CONSIDER_STRESS_OR_MEDS",
      });
    }

    return results;
  }

  private hasAbnormalNightDipping(data: MapaClinicalData): boolean {
    const thresholds = this.thresholds.nightDippingThresholds;
    if (!thresholds) return false;
    for (const value of [data.systolicNightDipping, data.diastolicNightDipping]) {
      if (value == null) continue;
      if (classifyNightDip(value, thresholds) !== "NORMAL") return true;
    }
    return false;
  }
}
