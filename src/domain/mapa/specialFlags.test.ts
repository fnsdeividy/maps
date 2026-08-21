import { describe, expect, it } from "vitest";
import {
  readRequiredSpecialFlags,
  summarizeSpecialFlags,
} from "@/domain/mapa/specialFlags";

describe("specialFlags", () => {
  it("exige as cinco respostas", () => {
    const form = new FormData();
    form.set("pregnancyStatus", "NO");
    form.set("alcoholUse", "YES");
    form.set("smoking", "UNKNOWN");
    form.set("insomnia", "NO");
    expect(readRequiredSpecialFlags(form)).toBeNull();

    form.set("caffeineUse", "YES");
    expect(readRequiredSpecialFlags(form)).toEqual({
      pregnancyStatus: "NO",
      alcoholUse: "YES",
      smoking: "UNKNOWN",
      insomnia: "NO",
      caffeineUse: "YES",
    });
  });

  it("resume rótulos em português", () => {
    expect(
      summarizeSpecialFlags({
        pregnancyStatus: "YES",
        alcoholUse: "NO",
        smoking: "UNKNOWN",
        insomnia: "YES",
        caffeineUse: "NO",
      }),
    ).toBe(
      "Gestante: sim. Uso de bebidas alcoólicas: não. Tabagismo: não informado. Insônia: sim. Uso de cafeína: não",
    );
  });
});
