export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
        defaultValue={defaultValue ?? ""}
        name={name}
        required={required}
        step={step}
        type={type}
      />
    </label>
  );
}
