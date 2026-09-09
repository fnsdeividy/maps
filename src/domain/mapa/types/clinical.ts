export type PhraseCategory =
  | "MEDICATION"
  | "TECHNICAL_QUALITY"
  | "AVERAGE_PRESSURE"
  | "PRESSURE_LOAD"
  | "PRESSURE_PEAK"
  | "NIGHT_DIPPING"
  | "SPECIAL_SITUATION"
  | "GENERAL_CONSIDERATION"
  | "CONCLUSION";

export type RuleStatus = "OK" | "PENDING_MEDICAL_CONFIGURATION";

export type RuleResult = {
  code: string;
  category: PhraseCategory;
  severity?: string;
  status?: RuleStatus;
  message: string;
  values?: Record<string, number>;
};

export type SpecialSituationCode =
  | "PREGNANT"
  | "OBESITY"
  | "DIABETES"
  | "ALZHEIMER"
  | "ALCOHOL"
  | "SMOKING"
  | "INSOMNIA"
  | "CAFFEINE"
  | "HEADACHE"
  | "CHEST_PAIN"
  | "DYSPNEA"
  | "DIZZINESS"
  | "ORTHOSTATIC"
  | "NAP"
  | "POSTPRANDIAL"
  | "BISOPROLOL"
  | "OFFICE_HIGH_BP";

export type TriStateClinicalFlag = "YES" | "NO" | "UNKNOWN";

export type MapaClinicalData = {
  currentMedications: string;
  cvMedicationStatus?: TriStateClinicalFlag | null;
  officeSystolicPressure?: number | null;
  officeDiastolicPressure?: number | null;
  officeHeartRate?: number | null;
  pregnancy?: boolean | null;
  pregnancyMonths?: number | null;
  pregnancyStatus?: TriStateClinicalFlag | null;
  alcoholUse?: TriStateClinicalFlag | null;
  smoking?: TriStateClinicalFlag | null;
  caffeineUse?: TriStateClinicalFlag | null;
  insomnia?: TriStateClinicalFlag | null;
  headache?: TriStateClinicalFlag | null;
  chestPain?: TriStateClinicalFlag | null;
  dyspnea?: TriStateClinicalFlag | null;
  dizziness?: TriStateClinicalFlag | null;
  totalMeasurements?: number | null;
  validMeasurements?: number | null;
  avg24hSystolic?: number | null;
  avg24hDiastolic?: number | null;
  awakeSystolic?: number | null;
  awakeDiastolic?: number | null;
  sleepSystolic?: number | null;
  sleepDiastolic?: number | null;
  awakeSystolicLoad?: number | null;
  awakeDiastolicLoad?: number | null;
  sleepSystolicLoad?: number | null;
  sleepDiastolicLoad?: number | null;
  systolicNightDipping?: number | null;
  diastolicNightDipping?: number | null;
  peakAwake?: boolean;
  peakSleep?: boolean;
  peakMorning?: boolean;
  peakWithHeartRateIncrease?: boolean;
  peakPhysicalEmotionalStress?: boolean;
  peakPressureNotes?: string | null;
  specialSituations?: SpecialSituationCode[];
};

export type OfficeVsMapaClassification =
  | "NORMOTENSION"
  | "SUSTAINED_HYPERTENSION"
  | "WHITE_COAT_HYPERTENSION"
  | "MASKED_HYPERTENSION"
  | "CONTROLLED_HYPERTENSION";

export type AveragePressureClass =
  | "BOTH_NORMAL"
  | "SYS_ELEVATED"
  | "DIA_ELEVATED"
  | "BOTH_ELEVATED";
