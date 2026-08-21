import { describe, expect, it } from "vitest";
import { AwpValidator } from "@/domain/mapa/import/awp/AwpValidator";

const validator = new AwpValidator();

function decoded(overrides: Partial<Parameters<AwpValidator["validateMeasurement"]>[0]> = {}) {
  return {
    index: 1,
    measuredAt: new Date(2024, 8, 13, 8, 30),
    systolic: 127,
    diastolic: 70,
    heartRate: 72,
    ...overrides,
  };
}

describe("AwpValidator", () => {
  it("aceita medição estruturalmente coerente", () => {
    const { measurement, warnings } = validator.validateMeasurement(decoded());
    expect(measurement.valid).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("invalida sem alterar o valor improvável", () => {
    const { measurement } = validator.validateMeasurement(decoded({ systolic: 320 }));
    expect(measurement.systolic).toBe(320);
    expect(measurement.valid).toBe(true);
  });

  it("invalida quando PAS não é maior que PAD", () => {
    const { measurement, warnings } = validator.validateMeasurement(
      decoded({ systolic: 70, diastolic: 90 }),
    );
    expect(measurement.valid).toBe(false);
    expect(warnings[0].code).toBe("INVALID_MEASUREMENT");
  });

  it("invalida valores não finitos", () => {
    expect(validator.validateMeasurement(decoded({ systolic: Number.NaN })).measurement.valid).toBe(
      false,
    );
    expect(validator.validateMeasurement(decoded({ diastolic: 0 })).measurement.valid).toBe(false);
  });

  it("invalida quando o equipamento registrou código de erro", () => {
    const { measurement } = validator.validateMeasurement(decoded({ errorCode: "E3" }));
    expect(measurement.valid).toBe(false);
  });

  it("invalida data inválida", () => {
    const { measurement } = validator.validateMeasurement(
      decoded({ measuredAt: new Date("invalid") }),
    );
    expect(measurement.valid).toBe(false);
  });

  it("aponta horários duplicados e fora de ordem", () => {
    const at = new Date(2024, 8, 13, 8, 30);
    const warnings = validator.validateSequence([
      { index: 1, measuredAt: at, systolic: 120, diastolic: 80, valid: true },
      { index: 2, measuredAt: at, systolic: 121, diastolic: 81, valid: true },
      {
        index: 3,
        measuredAt: new Date(2024, 8, 13, 7, 30),
        systolic: 122,
        diastolic: 82,
        valid: true,
      },
    ]);

    expect(warnings.map((warning) => warning.code)).toEqual([
      "DUPLICATE_TIMESTAMP",
      "NON_MONOTONIC_TIMESTAMPS",
    ]);
  });

  it("usa o comentário do equipamento como motivo de invalidez", () => {
    const { measurement } = validator.validateMeasurement(
      decoded({
        systolic: 0,
        diastolic: 0,
        heartRate: 0,
        deviceComment: "Sem sinal",
      }),
    );
    expect(measurement.valid).toBe(false);
    expect(measurement.deviceComment).toBe("Sem sinal");
    expect(measurement.invalidReason).toBe("Sem sinal");
  });
});
