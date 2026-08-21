export const guidelineFooter =
  "As considerações descritas neste laudo são fundamentadas na Diretriz Brasileira de Hipertensão Arterial – 2025.";

/** Remove o rodapé da diretriz de textos já gerados (laudos antigos). */
export function stripGuidelineFooter(
  text: string,
  footer: string = guidelineFooter,
): string {
  return text
    .replace(footer, "")
    .replace(
      /As considerações descritas neste laudo são fundamentadas na Diretriz Brasileira de Hipertensão Arterial[^.]*(?:–|-)?\s*\d{4}\.?/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}
