import { describe, expect, it } from "vitest";
import {
  buildOfficialPeakNarrative,
  peakFlagPhrasesFrom,
} from "./pressurePeaks";

function at(hour: number, minute: number) {
  return new Date(Date.UTC(2026, 7, 25, hour, minute, 0));
}

describe("buildOfficialPeakNarrative", () => {
  it("monta picos de vigília e sono no formato do roteiro", () => {
    const text = buildOfficialPeakNarrative(
      [
        {
          measuredAt: at(9, 19),
          systolic: 182,
          diastolic: 78,
          valid: true,
          observation: "subindo escada",
        },
        {
          measuredAt: at(9, 45),
          systolic: 150,
          diastolic: 116,
          valid: true,
        },
        {
          measuredAt: at(23, 30),
          systolic: 128,
          diastolic: 70,
          valid: true,
        },
      ],
      { start: "22:00", end: "06:00" },
    );

    expect(text).toContain(
      "Maior valor pressórico sistólico (182mmHg) na vigília ocorreu às 09:19h.",
    );
    expect(text).toContain("Sintoma associado: subindo escada (sic)");
    expect(text).toContain(
      "Maior valor pressórico diastólico (116mmHg) na vigília, ocorrido às 09:45h.",
    );
    expect(text).toContain("Sintoma associado: não relatado (sic)");
    expect(text).toContain("Pico pressórico durante o Sono.");
    expect(text).toContain(
      "Maior valor pressórico sistólico (128mmHg) no sono ocorreu às 23:30h.",
    );
  });

  it("ignora medições inválidas", () => {
    const text = buildOfficialPeakNarrative(
      [
        {
          measuredAt: at(10, 0),
          systolic: 200,
          diastolic: 120,
          valid: false,
        },
        {
          measuredAt: at(11, 0),
          systolic: 140,
          diastolic: 80,
          valid: true,
        },
      ],
      null,
    );
    expect(text).toContain("(140mmHg)");
    expect(text).not.toContain("200mmHg");
  });
});

describe("peakFlagPhrasesFrom", () => {
  it("preserva flags manuais ao reescrever o bloco", () => {
    expect(
      peakFlagPhrasesFrom(
        "Pico pressórico durante a Vigília. Concomitante aumento da frequência cardíaca.",
      ),
    ).toEqual(["Concomitante aumento da frequência cardíaca."]);
  });
});
