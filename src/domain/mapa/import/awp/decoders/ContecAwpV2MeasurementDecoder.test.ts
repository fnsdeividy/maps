import { describe, expect, it } from "vitest";
import {
  ContecAwpV2MeasurementDecoder,
  InvalidAwpMeasurementLengthError,
  InvalidHexValueError,
  parseHex,
} from "./ContecAwpV2MeasurementDecoder";
import type { AwpDecodeContext } from "./AwpMeasurementDecoder";

const decoder = new ContecAwpV2MeasurementDecoder();

const V2_CONTEXT: AwpDecodeContext = {
  formatId: "contec-abpm50-ini-v2.0",
};

function decode(raw: string, index = 1) {
  return decoder.decode({ index, key: String(index), raw, context: V2_CONTEXT });
}

describe("parseHex", () => {
  it("converte pares hexadecimais", () => {
    expect(parseHex("07EA")).toBe(2026);
    expect(parseHex("4C")).toBe(76);
  });

  it("rejeita valor não finito", () => {
    expect(() => parseHex("ZZ")).toThrow(InvalidHexValueError);
  });
});

describe("ContecAwpV2MeasurementDecoder", () => {
  it("decodifica 07EA0812080000007900440056004C0001000000000", () => {
    const outcome = decode("07EA0812080000007900440056004C0001000000000");

    expect(outcome.status).toBe("DECODED");
    if (outcome.status !== "DECODED") return;

    expect(outcome.measurement.measuredAt.getUTCFullYear()).toBe(2026);
    expect(outcome.measurement.measuredAt.getUTCMonth()).toBe(7);
    expect(outcome.measurement.measuredAt.getUTCDate()).toBe(18);
    expect(outcome.measurement.measuredAt.getUTCHours()).toBe(8);
    expect(outcome.measurement.measuredAt.getUTCMinutes()).toBe(0);
    expect(outcome.measurement.systolic).toBe(121);
    expect(outcome.measurement.diastolic).toBe(68);
    expect(outcome.measurement.meanArterialPressure).toBe(86);
    expect(outcome.measurement.heartRate).toBe(76);
    expect(outcome.measurement.rawTail).toBe("0001000000000");
  });

  it("decodifica 07E4090A131A00009200630073005B0001000000010", () => {
    const outcome = decode("07E4090A131A00009200630073005B0001000000010");

    expect(outcome.status).toBe("DECODED");
    if (outcome.status !== "DECODED") return;

    expect(outcome.measurement.measuredAt.getUTCFullYear()).toBe(2020);
    expect(outcome.measurement.measuredAt.getUTCMonth()).toBe(8);
    expect(outcome.measurement.measuredAt.getUTCDate()).toBe(10);
    expect(outcome.measurement.measuredAt.getUTCHours()).toBe(19);
    expect(outcome.measurement.measuredAt.getUTCMinutes()).toBe(26);
    expect(outcome.measurement.systolic).toBe(146);
    expect(outcome.measurement.diastolic).toBe(99);
    expect(outcome.measurement.meanArterialPressure).toBe(115);
    expect(outcome.measurement.heartRate).toBe(91);
    expect(outcome.measurement.rawTail).toBe("0001000000010");
  });

  it("preserva wall-clock 08:35 do registro 07EA08110823… (sem UTC−3)", () => {
    const outcome = decode("07EA0811082300008A005F006D00510001000000000");

    expect(outcome.status).toBe("DECODED");
    if (outcome.status !== "DECODED") return;

    expect(outcome.measurement.measuredAt.getUTCFullYear()).toBe(2026);
    expect(outcome.measurement.measuredAt.getUTCMonth()).toBe(7);
    expect(outcome.measurement.measuredAt.getUTCDate()).toBe(17);
    expect(outcome.measurement.measuredAt.getUTCHours()).toBe(8);
    expect(outcome.measurement.measuredAt.getUTCMinutes()).toBe(35);
    expect(outcome.measurement.systolic).toBe(138);
    expect(outcome.measurement.diastolic).toBe(95);
  });

  it("rejeita registro com menos de 30 caracteres hex", () => {
    const outcome = decode("07E4090D081E007F0046");

    expect(outcome.status).toBe("UNDECODED");
    if (outcome.status !== "UNDECODED") return;
    expect(outcome.note).toBe("INVALID_MEASUREMENT_LENGTH");
    expect(outcome.warnings.some((warning) => warning.code === "INVALID_MEASUREMENT_LENGTH")).toBe(
      true,
    );
  });

  it("rejeita data hexadecimal inválida", () => {
    const outcome = decode("07EA0012080000007900440056004C0001000000000");

    expect(outcome.status).toBe("UNDECODED");
    if (outcome.status !== "UNDECODED") return;
    expect(outcome.note).toBe("INVALID_DATE");
    expect(outcome.warnings.some((warning) => warning.code === "INVALID_DATE")).toBe(true);
  });

  it("aceita comprimento ímpar quando há caracteres suficientes para FC", () => {
    expect(
      decoder.canDecode({
        index: 1,
        key: "1",
        raw: "07EA0812080000007900440056004C0001000000000",
        context: V2_CONTEXT,
      }),
    ).toBe(true);
  });

  it("não decodifica fora do formato v2.0", () => {
    expect(
      decoder.canDecode({
        index: 1,
        key: "1",
        raw: "07EA0812080000007900440056004C0001000000000",
        context: { formatId: "contec-abpm50-ini-v1.0" },
      }),
    ).toBe(false);
  });
});

describe("InvalidAwpMeasurementLengthError", () => {
  it("expõe o comprimento recebido", () => {
    const error = new InvalidAwpMeasurementLengthError(12);
    expect(error.length).toBe(12);
    expect(error.name).toBe("InvalidAwpMeasurementLengthError");
  });
});
