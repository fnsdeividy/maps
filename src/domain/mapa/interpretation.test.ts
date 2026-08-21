import { describe, expect, it } from "vitest";
import {
  hasStandaloneConsiderations,
  interpretationDisplayText,
} from "./interpretation";

const consideration =
  "Os valores das médias pressóricas 24horas do MAPA comparadas aos valores de consultório sugerem Hipertensão do Avental Branco.";
const conclusion =
  "Exame com valores compatíveis com Hipertensão do Avental Branco.";
const extra =
  "Considerar o uso de medicamentos de efeito cardiovascular.";

describe("interpretationDisplayText", () => {
  it("não junta consideração e conclusão do mesmo diagnóstico", () => {
    expect(interpretationDisplayText(consideration, conclusion)).toBe(
      conclusion,
    );
  });

  it("usa a consideração quando a interpretação está vazia", () => {
    expect(interpretationDisplayText(consideration, "Não informado.")).toBe(
      consideration,
    );
    expect(interpretationDisplayText(consideration, "")).toBe(consideration);
  });

  it("mantém considerações extras além do diagnóstico", () => {
    expect(
      interpretationDisplayText(`${consideration} ${extra}`, conclusion),
    ).toBe(`${conclusion} ${extra}`);
  });
});

describe("hasStandaloneConsiderations", () => {
  it("esconde considerações que só repetem o diagnóstico", () => {
    expect(hasStandaloneConsiderations(consideration, conclusion)).toBe(false);
    expect(hasStandaloneConsiderations("Não informado.", conclusion)).toBe(
      false,
    );
  });

  it("mantém considerações com conteúdo próprio", () => {
    expect(hasStandaloneConsiderations(extra, conclusion)).toBe(true);
  });
});
