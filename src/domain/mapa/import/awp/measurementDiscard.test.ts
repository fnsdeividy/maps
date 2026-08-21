import { describe, expect, it } from "vitest";
import {
  applyMeasurementDiscard,
  applyMeasurementDiscards,
  DISCARDED_BY_REVIEW_REASON,
} from "./measurementDiscard";
import type { MapaMeasurement } from "./types";

function measurement(
  index: number,
  extras: Partial<MapaMeasurement> = {},
): MapaMeasurement {
  return {
    index,
    measuredAt: new Date(Date.UTC(2026, 6, 27, 8, 35, 0)),
    systolic: 138,
    diastolic: 95,
    heartRate: 81,
    valid: true,
    ...extras,
  };
}

describe("applyMeasurementDiscard", () => {
  it("desconsidera medição válida e a restaura", () => {
    const discarded = applyMeasurementDiscard(measurement(1), true);
    expect(discarded.valid).toBe(false);
    expect(discarded.discarded).toBe(true);
    expect(discarded.invalidReason).toBe(DISCARDED_BY_REVIEW_REASON);

    const restored = applyMeasurementDiscard(discarded, false);
    expect(restored.valid).toBe(true);
    expect(restored.discarded).toBe(false);
    expect(restored.invalidReason).toBeUndefined();
  });

  it("não altera medição já inválida pelo aparelho", () => {
    const invalid = measurement(2, {
      valid: false,
      invalidReason: "Sem sinal",
    });
    expect(applyMeasurementDiscard(invalid, true)).toEqual(invalid);
  });

  it("aplica a lista de índices ao conjunto sem restaurar as demais", () => {
    const alreadyDiscarded = applyMeasurementDiscard(measurement(1), true);
    const result = applyMeasurementDiscards(
      [alreadyDiscarded, measurement(2), measurement(3)],
      [2],
    );
    expect(result[0].discarded).toBe(true);
    expect(result[1].discarded).toBe(true);
    expect(result[2].valid).toBe(true);
  });
});
