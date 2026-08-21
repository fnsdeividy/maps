import type { DecodedMeasurement } from "./decoders/AwpMeasurementDecoder";
import type { MapaMeasurement, ParseWarning } from "./types";

export interface MeasurementValidation {
  measurement: MapaMeasurement;
  warnings: ParseWarning[];
}

function isPositiveFinite(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/**
 * Validação estrutural, não clínica.
 *
 * Nenhum valor é corrigido, arredondado ou substituído: uma medição improvável
 * apenas recebe `valid: false` e um warning. Faixas fisiológicas não são
 * usadas para "consertar" leitura do aparelho.
 */
export class AwpValidator {
  validateMeasurement(decoded: DecodedMeasurement): MeasurementValidation {
    const warnings: ParseWarning[] = [];
    const problems: string[] = [];

    if (!(decoded.measuredAt instanceof Date) || Number.isNaN(decoded.measuredAt.getTime())) {
      problems.push("data/hora inválida");
    }
    if (!isPositiveFinite(decoded.systolic)) problems.push("PAS ausente ou não numérica");
    if (!isPositiveFinite(decoded.diastolic)) problems.push("PAD ausente ou não numérica");
    if (
      isPositiveFinite(decoded.systolic) &&
      isPositiveFinite(decoded.diastolic) &&
      decoded.systolic <= decoded.diastolic
    ) {
      problems.push("PAS não é maior que PAD");
    }
    if (decoded.heartRate !== undefined && !isPositiveFinite(decoded.heartRate)) {
      problems.push("FC não numérica");
    }
    if (
      decoded.meanArterialPressure !== undefined &&
      !isPositiveFinite(decoded.meanArterialPressure)
    ) {
      problems.push("PAM não numérica");
    }
    if (decoded.errorCode) {
      problems.push(`equipamento registrou o código de erro ${decoded.errorCode}`);
    }

    const valid = problems.length === 0;
    let invalidReason: string | undefined;

    if (!valid) {
      invalidReason = decoded.deviceComment?.trim() || problems.join("; ");
      warnings.push({
        code: "INVALID_MEASUREMENT",
        message: `Medição ${decoded.index} marcada como inválida: ${invalidReason}.`,
        recordIndex: decoded.index,
      });
    }

    return {
      measurement: {
        ...decoded,
        valid,
        invalidReason,
      },
      warnings,
    };
  }

  /** Coerência do conjunto: horários repetidos ou fora de ordem. */
  validateSequence(measurements: MapaMeasurement[]): ParseWarning[] {
    const warnings: ParseWarning[] = [];
    const seen = new Map<number, number>();
    let previous: number | undefined;
    let outOfOrder = 0;

    for (const measurement of measurements) {
      const time = measurement.measuredAt.getTime();
      if (Number.isNaN(time)) continue;

      const duplicateOf = seen.get(time);
      if (duplicateOf !== undefined) {
        warnings.push({
          code: "DUPLICATE_TIMESTAMP",
          message: `Registro ${measurement.index} tem o mesmo horário do registro ${duplicateOf}.`,
          recordIndex: measurement.index,
        });
      } else {
        seen.set(time, measurement.index);
      }

      if (previous !== undefined && time < previous) outOfOrder += 1;
      previous = time;
    }

    if (outOfOrder > 0) {
      warnings.push({
        code: "NON_MONOTONIC_TIMESTAMPS",
        message: `${outOfOrder} registro(s) fora de ordem cronológica no arquivo.`,
      });
    }

    return warnings;
  }
}
