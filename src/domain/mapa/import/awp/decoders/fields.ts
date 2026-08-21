export type AwpFieldName =
  | "date"
  | "time"
  | "datetime"
  | "systolic"
  | "diastolic"
  | "heartRate"
  | "meanArterialPressure"
  | "errorCode"
  | "index"
  | "ignored";

/**
 * Vocabulário de nomes que o próprio arquivo pode usar para cada campo.
 * Só é aplicado quando o rótulo está escrito no arquivo — nunca por posição
 * adivinhada.
 */
const SYNONYMS: Record<string, AwpFieldName> = {
  date: "date",
  data: "date",
  day: "date",
  dia: "date",
  measuredate: "date",
  recorddate: "date",

  time: "time",
  hora: "time",
  hour: "time",
  clock: "time",
  measuretime: "time",
  recordtime: "time",

  datetime: "datetime",
  timestamp: "datetime",
  datahora: "datetime",
  measuredat: "datetime",

  sys: "systolic",
  sbp: "systolic",
  systolic: "systolic",
  systole: "systolic",
  pas: "systolic",
  high: "systolic",
  highpressure: "systolic",

  dia_: "diastolic",
  dbp: "diastolic",
  diastolic: "diastolic",
  diastole: "diastolic",
  pad: "diastolic",
  low: "diastolic",
  lowpressure: "diastolic",

  hr: "heartRate",
  pr: "heartRate",
  bpm: "heartRate",
  pulse: "heartRate",
  pulserate: "heartRate",
  heartrate: "heartRate",
  fc: "heartRate",

  map: "meanArterialPressure",
  mean: "meanArterialPressure",
  meanpressure: "meanArterialPressure",
  pam: "meanArterialPressure",

  error: "errorCode",
  errorcode: "errorCode",
  errcode: "errorCode",
  err: "errorCode",
  code: "errorCode",
  status: "errorCode",

  no: "index",
  num: "index",
  number: "index",
  index: "index",
  id: "index",
};

/**
 * `DIA` é ambíguo: em inglês significa diastólica, em português abrevia "dia"
 * (data). Só é resolvido para diastólica quando o arquivo também traz um campo
 * claramente sistólico em inglês.
 */
export function normalizeFieldName(
  label: string,
  options: { preferEnglishDia?: boolean } = {},
): AwpFieldName | undefined {
  const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key === "dia") {
    return options.preferEnglishDia ? "diastolic" : undefined;
  }
  return SYNONYMS[key];
}

export function hasEnglishSystolicLabel(labels: string[]): boolean {
  return labels.some((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
    return key === "sys" || key === "sbp" || key === "systolic" || key === "systole";
  });
}
