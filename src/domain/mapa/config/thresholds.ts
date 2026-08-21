export type PressurePair = {
  systolic: number;
  diastolic: number;
};

export type MapaThresholds = {
  full24Hours: PressurePair;
  awake: PressurePair;
  sleep: PressurePair;
  officeThresholds: PressurePair | null;
  significantlyElevatedThresholds: PressurePair | null;
  pressureLoadThresholds: {
    elevatedPercent: number;
  } | null;
  nightDippingThresholds: {
    absentMax: number;
    attenuatedMax: number;
    normalMax: number;
  } | null;
  technicalQualityThresholds: {
    minValidPercentage: number;
  } | null;
  /** Picos continuam manuais no MVP; detecção automática ainda não definida. */
  pressurePeakThresholds: null;
};

export const PENDING_MEDICAL_CONFIGURATION_MESSAGE =
  "Este parâmetro ainda depende de configuração médica.";

/**
 * Limiares padrão alinhados ao roteiro clínico do laudo e à Diretriz Brasileira
 * de Hipertensão Arterial. Podem ser editados em Configurações.
 */
export const mapaThresholds: MapaThresholds = {
  full24Hours: {
    systolic: 130,
    diastolic: 80,
  },
  awake: {
    systolic: 135,
    diastolic: 85,
  },
  sleep: {
    systolic: 120,
    diastolic: 70,
  },
  officeThresholds: {
    systolic: 140,
    diastolic: 90,
  },
  significantlyElevatedThresholds: {
    systolic: 160,
    diastolic: 100,
  },
  pressureLoadThresholds: {
    elevatedPercent: 25,
  },
  nightDippingThresholds: {
    absentMax: 0,
    attenuatedMax: 10,
    normalMax: 20,
  },
  technicalQualityThresholds: {
    minValidPercentage: 70,
  },
  pressurePeakThresholds: null,
};
