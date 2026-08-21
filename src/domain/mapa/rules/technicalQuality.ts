export function computeValidMeasurementsPercentage(
  validMeasurements: number,
  totalMeasurements: number,
): number | null {
  if (!totalMeasurements || totalMeasurements <= 0) {
    return null;
  }
  return (validMeasurements / totalMeasurements) * 100;
}
