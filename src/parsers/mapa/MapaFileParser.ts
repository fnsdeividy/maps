export type MapaParsedData = {
  examDate?: Date;
  currentMedications?: string;
  officeSystolicPressure?: number;
  officeDiastolicPressure?: number;
  officeHeartRate?: number;
  pregnancy?: boolean;
  pregnancyMonths?: number;
  totalMeasurements?: number;
  validMeasurements?: number;
  avg24hSystolic?: number;
  avg24hDiastolic?: number;
  awakeSystolic?: number;
  awakeDiastolic?: number;
  sleepSystolic?: number;
  sleepDiastolic?: number;
  awakeSystolicLoad?: number;
  awakeDiastolicLoad?: number;
  sleepSystolicLoad?: number;
  sleepDiastolicLoad?: number;
  systolicNightDipping?: number;
  diastolicNightDipping?: number;
  technicalComments?: string;
};

export interface MapaFileParser {
  parse(file: Buffer): Promise<MapaParsedData>;
}
