export const PRINT_MEASUREMENT_ROWS_PER_PAGE = 28;

export function listPrintMeasurements<T extends { valid: boolean }>(
  measurements: T[],
): T[] {
  return measurements.filter((row) => row.valid);
}

export function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }
  return pages;
}
