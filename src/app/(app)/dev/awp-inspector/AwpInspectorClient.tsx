"use client";

import { Fragment, useActionState, useState } from "react";
import { HexViewer } from "@/components/HexViewer";
import { formatDateTime } from "@/lib/dates";
import { formatFileSize } from "@/lib/numbers";
import {
  analyzeAwpStructureWithAiAction,
  inspectAwpFileAction,
  type AiHypothesisState,
  type InspectorState,
} from "./actions";

function formatDecodedRecord(decoded: NonNullable<InspectorState["inspection"]>["records"][number]["decoded"]) {
  if (!decoded?.measuredAt) return "—";

  const measuredAt = formatDateTime(decoded.measuredAt);
  const lines = [
    measuredAt,
    `PAS: ${decoded.systolic ?? "—"}`,
    `PAD: ${decoded.diastolic ?? "—"}`,
    `PAM: ${decoded.meanArterialPressure ?? "—"}`,
    `FC: ${decoded.heartRate ?? "—"}`,
  ];

  if (decoded.rawTail) {
    lines.push(`Raw tail: ${decoded.rawTail}`);
  }

  return lines.join("\n");
}

export function AwpInspectorClient({ aiAvailable }: { aiAvailable: boolean }) {
  const [state, inspect, inspecting] = useActionState<InspectorState, FormData>(
    inspectAwpFileAction,
    {},
  );
  const [ai, analyzeWithAi, analyzing] = useActionState<AiHypothesisState, FormData>(
    analyzeAwpStructureWithAiAction,
    {},
  );
  const [openRecord, setOpenRecord] = useState<number | null>(null);

  const inspection = state.inspection;

  return (
    <div className="space-y-6">
      <form action={inspect} className="rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Arquivo do equipamento</span>
          <input className="w-full text-sm" name="awpFile" type="file" />
        </label>
        <button
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          disabled={inspecting}
          type="submit"
        >
          {inspecting ? "Inspecionando..." : "Inspecionar arquivo"}
        </button>
        {state.error ? <p className="mt-3 text-sm text-red-700">{state.error}</p> : null}
      </form>

      {inspection ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Arquivo</h2>
            <dl className="mt-3 grid grid-cols-[220px_1fr] gap-y-1">
              <dt className="text-slate-500">Nome</dt>
              <dd>{inspection.file.name}</dd>
              <dt className="text-slate-500">Tamanho</dt>
              <dd>{formatFileSize(inspection.file.size)}</dd>
              <dt className="text-slate-500">SHA-256</dt>
              <dd className="break-all font-mono text-xs">{inspection.file.sha256}</dd>
              <dt className="text-slate-500">Encoding detectado</dt>
              <dd>
                {inspection.file.encoding}
                {inspection.file.textual ? "" : " (conteúdo binário)"}
              </dd>
              <dt className="text-slate-500">Assinatura (16 bytes)</dt>
              <dd className="font-mono text-xs">{inspection.file.signature}</dd>
              <dt className="text-slate-500">Formato detectado</dt>
              <dd>{inspection.file.detectedFormat}</dd>
              <dt className="text-slate-500">Versão detectada</dt>
              <dd>{inspection.file.detectedVersion ?? "não declarada"}</dd>
              <dt className="text-slate-500">Confiança</dt>
              <dd>{inspection.file.confidence}</dd>
              <dt className="text-slate-500">Versão do parser</dt>
              <dd>{inspection.file.parserVersion}</dd>
            </dl>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">
                Evidências da detecção
              </summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                {inspection.file.formatEvidence.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </details>
            {inspection.parseError ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                O parser recusou este arquivo: {inspection.parseError} Os dados brutos abaixo
                continuam disponíveis para investigação.
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">
              Metadados ({inspection.metadata.length})
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Campo</th>
                  <th className="px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {inspection.metadata.map((entry) => (
                  <tr className="border-t border-slate-100" key={entry.key}>
                    <td className="px-4 py-2 font-mono text-xs">{entry.key}</td>
                    <td className="break-all px-4 py-2">{entry.value}</td>
                  </tr>
                ))}
                {inspection.metadata.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-slate-500" colSpan={2}>
                      Nenhum metadado no formato chave=valor.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold">
                Registros ({inspection.records.length})
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {inspection.records.length} registros encontrados ·{" "}
                {
                  inspection.records.filter(
                    (record) => record.status === "DECODED" || record.status === "INVALID",
                  ).length
                }{" "}
                registros estruturalmente decodificados
              </p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Index</th>
                  <th className="px-4 py-2">Raw</th>
                  <th className="px-4 py-2">Resultado decodificado</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Bytes</th>
                </tr>
              </thead>
              <tbody>
                {inspection.records.map((record) => (
                  <Fragment key={record.index}>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{record.key}</td>
                      <td className="max-w-[240px] truncate px-4 py-2 font-mono text-xs">
                        {record.raw}
                      </td>
                      <td className="px-4 py-2 text-xs whitespace-pre-line">
                        {record.decoded
                          ? formatDecodedRecord(record.decoded)
                          : (record.note ?? "—")}
                      </td>
                      <td className="px-4 py-2 text-xs">{record.status}</td>
                      <td className="px-4 py-2">
                        {record.bytes && record.bytes.length > 0 ? (
                          <button
                            className="text-xs text-teal-700 underline"
                            onClick={() =>
                              setOpenRecord(openRecord === record.index ? null : record.index)
                            }
                            type="button"
                          >
                            {openRecord === record.index ? "ocultar" : "ver bytes"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                    {openRecord === record.index && record.bytes ? (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td className="px-4 py-3" colSpan={5}>
                          <HexViewer bytes={record.bytes} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Informações desconhecidas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nada é descartado em silêncio: tudo o que o parser não interpretou aparece aqui.
            </p>
            <h3 className="mt-3 text-xs font-semibold uppercase text-slate-500">
              Linhas não reconhecidas
            </h3>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-3 text-xs">
              {inspection.unknownFields.join("\n") || "—"}
            </pre>
            <h3 className="mt-3 text-xs font-semibold uppercase text-slate-500">Comentários</h3>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-3 text-xs">
              {inspection.comments.join("\n") || "—"}
            </pre>
            <h3 className="mt-3 text-xs font-semibold uppercase text-slate-500">Warnings</h3>
            <ul className="mt-1 space-y-1 text-xs">
              {inspection.warnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>
                  <span className="font-mono">{warning.code}</span>
                  {warning.recordIndex !== undefined ? ` [#${warning.recordIndex}]` : ""} —{" "}
                  {warning.message}
                </li>
              ))}
              {inspection.warnings.length === 0 ? <li>—</li> : null}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold">Análise assistida por IA</h2>
            <p className="mt-1 text-xs text-slate-500">
              Envia apenas a estrutura anonimizada (nomes de campos, amostras de registros e
              tamanhos). Nome, documento, contato e o arquivo original nunca são enviados.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">
                Ver exatamente o que será enviado
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-50 p-3 text-xs">
                {JSON.stringify(inspection.anonymized, null, 2)}
              </pre>
            </details>
            <form action={analyzeWithAi} className="mt-3">
              <input
                name="structure"
                type="hidden"
                value={JSON.stringify(inspection.anonymized)}
              />
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-60"
                disabled={analyzing || !aiAvailable}
                type="submit"
              >
                {analyzing ? "Consultando..." : "Analisar estrutura com IA"}
              </button>
              {!aiAvailable ? (
                <span className="ml-3 text-xs text-slate-500">
                  Requer OPENAI_API_KEY em desenvolvimento.
                </span>
              ) : null}
            </form>
            {ai.error ? <p className="mt-3 text-sm text-red-700">{ai.error}</p> : null}
            {ai.analysis ? (
              <div className="mt-4 rounded border border-dashed border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase text-amber-800">
                  Sugestão experimental — não utilizada em produção
                </p>
                <ul className="mt-2 space-y-2 text-xs">
                  {ai.analysis.hypotheses.map((hypothesis, index) => (
                    <li key={`${hypothesis.target}-${index}`}>
                      <strong>{hypothesis.target}</strong> ({hypothesis.confidence}):{" "}
                      {hypothesis.hypothesis}
                      <span className="block text-amber-900">
                        Como confirmar: {hypothesis.howToConfirm}
                      </span>
                    </li>
                  ))}
                </ul>
                {ai.analysis.openQuestions.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs">
                    {ai.analysis.openQuestions.map((question, index) => (
                      <li key={`${question}-${index}`}>{question}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-xs text-amber-900">
                  Nenhuma hipótese altera o parser automaticamente. Só registre um layout em
                  hexLayouts.ts após confirmá-lo em vários registros.
                </p>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
