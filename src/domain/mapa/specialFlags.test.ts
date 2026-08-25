import { describe, expect, it } from "vitest";
import {
  readRequiredSpecialFlags,
  summarizeSpecialFlags,
} from "@/domain/mapa/specialFlags";

describe("specialFlags", () => {
  it("exige todas as respostas", () => {
    const form = new FormData();
    form.set("pregnancyStatus", "NO");
    form.set("alcoholUse", "YES");
    form.set("smoking", "UNKNOWN");
    form.set("caffeineUse", "YES");
    form.set("headache", "YES");
    form.set("insomnia", "NO");
    form.set("chestPain", "NO");
    form.set("dyspnea", "UNKNOWN");
    expect(readRequiredSpecialFlags(form)).toBeNull();

    form.set("dizziness", "NO");
    expect(readRequiredSpecialFlags(form)).toBeNull();

    form.set("cvMedicationStatus", "YES");
    expect(readRequiredSpecialFlags(form)).toEqual({
      pregnancyStatus: "NO",
      alcoholUse: "YES",
      smoking: "UNKNOWN",
      caffeineUse: "YES",
      headache: "YES",
      insomnia: "NO",
      chestPain: "NO",
      dyspnea: "UNKNOWN",
      dizziness: "NO",
      cvMedicationStatus: "YES",
    });
  });

  it("resume rótulos em português", () => {
    expect(
      summarizeSpecialFlags({
        pregnancyStatus: "YES",
        alcoholUse: "NO",
        smoking: "UNKNOWN",
        caffeineUse: "NO",
        headache: "YES",
        insomnia: "YES",
        chestPain: "NO",
        dyspnea: "NO",
        dizziness: "YES",
        cvMedicationStatus: "YES",
      }),
    ).toBe(
      "Gestante: sim. Uso de bebidas alcoólicas: não. Tabagismo: não informado. Uso de cafeína: não. Dores de cabeça: sim. Insônia: sim. Dores no peito: não. Falta de ar: não. Tontura: sim. Medicação de efeito cardiovascular: sim",
    );
  });
});
