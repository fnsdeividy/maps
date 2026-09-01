import type { RuleResult } from "../types/clinical";

export type PhraseRecord = {
  code: string;
  category: string;
  text: string;
  active: boolean;
};

function interpolate(
  template: string,
  values?: Record<string, number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    if (value == null || Number.isNaN(value)) return `{${key}}`;
    if (key === "systolic" || key === "diastolic") {
      return String(Math.round(value));
    }
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 10) / 10);
  });
}

export class ReportPhraseResolver {
  constructor(private readonly phrases: PhraseRecord[]) {}

  resolve(results: RuleResult[]): Array<RuleResult & { text: string }> {
    const passthrough = new Set([
      "MED_CUSTOM",
      "PEAK_NOTES",
      "MED_OFFICE_BP",
    ]);

    return results.map((result) => {
      if (passthrough.has(result.code)) {
        return { ...result, text: result.message };
      }
      const phrase = this.phrases.find(
        (item) => item.code === result.code && item.active,
      );
      let text = phrase
        ? interpolate(phrase.text, result.values)
        : result.message;
      if (/\{[a-zA-Z]+\}/.test(text)) {
        text = result.message;
      }
      return { ...result, text };
    });
  }
}
