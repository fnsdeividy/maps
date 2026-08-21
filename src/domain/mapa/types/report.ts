export type StructuredReportSections = {
  medications: string;
  technicalComments: string;
  averagePressure: string;
  pressureLoad: string;
  pressurePeaks: string;
  nightDipping: string;
  specialSituations: string;
  generalConsiderations: string;
  conclusion: string;
};

export type ImmutableReportFacts = {
  numbers: number[];
  conclusion: string;
  medicationsSource: string;
};
