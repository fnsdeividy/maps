import { describe, expect, it } from "vitest";
import {
  chunkRows,
  listPrintMeasurements,
  PRINT_MEASUREMENT_ROWS_PER_PAGE,
} from "./printMeasurements";

describe("listPrintMeasurements", () => {
  it("omits invalid rows from the printed listing", () => {
    const listed = listPrintMeasurements([
      { index: 1, valid: true },
      { index: 2, valid: false },
      { index: 3, valid: true },
      { index: 4, valid: false },
    ]);

    expect(listed.map((row) => row.index)).toEqual([1, 3]);
  });
});

describe("chunkRows", () => {
  it("paginates valid rows so each print page can repeat the header", () => {
    const rows = Array.from({ length: 60 }, (_, index) => index + 1);
    const pages = chunkRows(rows, PRINT_MEASUREMENT_ROWS_PER_PAGE);

    expect(pages).toHaveLength(3);
    expect(pages[0]?.[0]).toBe(1);
    expect(pages[0]?.at(-1)).toBe(28);
    expect(pages[2]).toEqual([57, 58, 59, 60]);
  });
});
