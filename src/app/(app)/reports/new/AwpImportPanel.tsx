"use client";

import { useActionState, useRef, useState } from "react";
import { analyzeAwpFileAction, type AwpAnalyzeState } from "../import/actions";

const ACCEPTED_EXTENSION = ".awp";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function AwpImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, formAction, pending] = useActionState<AwpAnalyzeState, FormData>(
    analyzeAwpFileAction,
    {},
  );

  function acceptFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
      setSelected(null);
      setLocalError("Somente arquivos .AWP são aceitos.");
      return;
    }
    setLocalError(null);
    setSelected({ name: file.name, size: file.size });
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    acceptFile(file);
  }

  const error = localError ?? state.error;

  return (
    <form action={formAction} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h2 className="font-semibold">Importar exame MAPA</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">Equipamento:</dt>
          <dd className="font-medium">CONTEC ABPM50</dd>
          <dt className="text-slate-500">Formato aceito:</dt>
          <dd className="font-medium">.awp</dd>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Não é preciso escolher ou cadastrar o paciente aqui: ele é criado automaticamente a
          partir da seção [PATIENTDATA] do arquivo.
        </p>
      </div>

      <div
        className={`rounded-lg border-2 border-dashed px-6 py-10 text-center text-sm ${
          dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-slate-50"
        }`}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={handleDrop}
      >
        <p className="text-slate-600">Arraste o arquivo .AWP aqui</p>
        <p className="mt-1 text-xs text-slate-500">ou</p>
        <button
          className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Escolher arquivo
        </button>
        <input
          accept=".awp"
          className="hidden"
          name="awpFile"
          onChange={(event) => acceptFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        {selected ? (
          <p className="mt-4 font-medium text-slate-800">
            {selected.name}{" "}
            <span className="font-normal text-slate-500">({formatSize(selected.size)})</span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        O arquivo é lido no servidor da aplicação e preservado sem alterações. Os valores das
        medições vêm exclusivamente do arquivo; nada é estimado.
      </p>

      <button
        className="rounded-md bg-teal-700 px-4 py-2 text-white disabled:opacity-60"
        disabled={pending || !selected}
        type="submit"
      >
        {pending ? "Analisando arquivo..." : "Analisar arquivo"}
      </button>
    </form>
  );
}
