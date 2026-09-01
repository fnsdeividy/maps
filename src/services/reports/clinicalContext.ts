import { roundMmHg } from "@/domain/mapa/rules/averagePressure";

export type ClinicalContextInput = {
  currentMedications: string | null;
  officeSystolicPressure: number | null;
  officeDiastolicPressure: number | null;
  avg24hSystolic: number | null;
  avg24hDiastolic: number | null;
  awakeSystolic: number | null;
  awakeDiastolic: number | null;
  sleepSystolic: number | null;
  sleepDiastolic: number | null;
  overallSystolicLoad?: number | null;
  overallDiastolicLoad?: number | null;
  awakeSystolicLoad: number | null;
  awakeDiastolicLoad: number | null;
  sleepSystolicLoad: number | null;
  sleepDiastolicLoad: number | null;
  systolicNightDipping: number | null;
  diastolicNightDipping: number | null;
  cvMedicationStatus?: string | null;
};

function numberPair(a: number | null | undefined, b: number | null | undefined): string | null {
  if (a == null && b == null) return null;
  return `${a ?? "—"}/${b ?? "—"}`;
}

function mmHgPair(a: number | null, b: number | null): string | null {
  if (a == null && b == null) return null;
  return `${a != null ? roundMmHg(a) : "—"}/${b != null ? roundMmHg(b) : "—"}`;
}

function percentLabel(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `${value}%`;
}

/**
 * Resumo clínico compacto para a IA. Todos os percentuais e médias já vêm
 * calculados pelo backend — a IA só usa estes valores, nunca os recalcula.
 */
export function buildClinicalContext(
  report: ClinicalContextInput,
  percentage: number | null,
): string {
  const parts: string[] = [
    "Métricas já calculadas pelo sistema. Não recalcule nenhuma métrica numérica. Utilize exatamente os valores abaixo. Não altere percentuais, não estime valores, não derive novas médias e não transforme valores baixos em altos ou vice-versa.",
  ];
  const add = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    parts.push(`${label}: ${value}`);
  };

  add("Válidas %", percentage != null ? Math.round(percentage) : null);
  add("Médias 24h", mmHgPair(report.avg24hSystolic, report.avg24hDiastolic));
  add("Médias vigília", mmHgPair(report.awakeSystolic, report.awakeDiastolic));
  add("Médias sono", mmHgPair(report.sleepSystolic, report.sleepDiastolic));
  add("Carga pressórica 24h PAS", percentLabel(report.overallSystolicLoad));
  add("Carga pressórica 24h PAD", percentLabel(report.overallDiastolicLoad));
  add("Carga pressórica vigília PAS", percentLabel(report.awakeSystolicLoad));
  add("Carga pressórica vigília PAD", percentLabel(report.awakeDiastolicLoad));
  add("Carga pressórica sono PAS", percentLabel(report.sleepSystolicLoad));
  add("Carga pressórica sono PAD", percentLabel(report.sleepDiastolicLoad));
  add("Descenso sistólico", percentLabel(report.systolicNightDipping));
  add("Descenso diastólico", percentLabel(report.diastolicNightDipping));
  add(
    "Cargas vigília S/D (já calculadas)",
    numberPair(report.awakeSystolicLoad, report.awakeDiastolicLoad),
  );
  add(
    "Cargas sono S/D (já calculadas)",
    numberPair(report.sleepSystolicLoad, report.sleepDiastolicLoad),
  );
  add(
    "PA consultório",
    mmHgPair(report.officeSystolicPressure, report.officeDiastolicPressure),
  );
  if (report.cvMedicationStatus === "YES") {
    add(
      "Medicação cardiovascular",
      "sim — classificar hipertensão controlada se o MAPA estiver normal; não citar medicação na interpretação",
    );
    add("Medicações em uso", report.currentMedications);
  } else if (report.cvMedicationStatus === "NO") {
    add("Medicação cardiovascular", "não");
  }

  return parts.join(" | ");
}
