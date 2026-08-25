"use client";

import {
  type TriStateFlag,
} from "@/domain/mapa/specialFlags";

const OPTIONS: Array<{ value: TriStateFlag; label: string }> = [
  { value: "YES", label: "Sim" },
  { value: "NO", label: "Não" },
  { value: "UNKNOWN", label: "Não informado" },
];

export function MedicationFields({
  defaultMedications = "",
  defaultStatus,
}: {
  defaultMedications?: string;
  defaultStatus?: TriStateFlag;
}) {
  return (
    <div className="col-span-2 space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          Medicação de efeito cardiovascular{" "}
          <span className="font-normal text-red-600">*</span>
        </p>
        <p className="mb-2 text-xs text-slate-500">
          Anti-hipertensivo ou outro remédio que baixa a pressão. Se sim e o
          MAPA estiver normal, a conclusão é hipertensão controlada — não
          normotensão verdadeira.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          {OPTIONS.map((option) => (
            <label
              className="inline-flex items-center gap-1.5"
              key={option.value}
            >
              <input
                defaultChecked={defaultStatus === option.value}
                name="cvMedicationStatus"
                required
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Qual remédio</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          defaultValue={defaultMedications}
          name="currentMedications"
          placeholder="Ex.: Losartana 50 mg, anlodipino 5 mg"
          rows={2}
        />
      </label>
    </div>
  );
}
