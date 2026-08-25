import { describe, expect, it } from "vitest";
import { isOnCardiovascularMedication } from "./cvMedication";

describe("isOnCardiovascularMedication", () => {
  it("só considera o tag Sim", () => {
    expect(
      isOnCardiovascularMedication({
        cvMedicationStatus: "YES",
        currentMedications: "Losartana 50 mg",
      }),
    ).toBe(true);
    expect(
      isOnCardiovascularMedication({
        cvMedicationStatus: "NO",
        currentMedications: "Losartana 50 mg",
      }),
    ).toBe(false);
    expect(
      isOnCardiovascularMedication({
        cvMedicationStatus: "UNKNOWN",
        currentMedications: "Losartana 50 mg",
      }),
    ).toBe(false);
  });
});
