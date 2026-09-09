export const CLINICAL_SITUATION_OPTIONS = [
  { value: "OBESITY", label: "Obesidade" },
  { value: "DIABETES", label: "Diabetes" },
  { value: "ALZHEIMER", label: "Alzheimer" },
  { value: "ORTHOSTATIC", label: "Redução pressórica ortostática" },
  { value: "NAP", label: "Redução pressórica associada à sesta" },
  { value: "POSTPRANDIAL", label: "Redução pressórica pós-prandial" },
] as const;

export function ClinicalSituationCheckboxes({
  defaults = [],
}: {
  defaults?: string[];
}) {
  const selected = new Set(defaults);
  return (
    <fieldset className="col-span-2 space-y-2">
      <legend className="text-sm font-semibold text-slate-800">
        Outras situações clínicas
      </legend>
      <p className="text-xs text-slate-500">
        Marque as que se aplicam. Entram em Situações especiais no laudo.
      </p>
      <div className="mt-2 space-y-2 text-sm">
        {CLINICAL_SITUATION_OPTIONS.map((option) => (
          <label className="flex gap-2" key={option.value}>
            <input
              defaultChecked={selected.has(option.value)}
              name="specialSituations"
              type="checkbox"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
