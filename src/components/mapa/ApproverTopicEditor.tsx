"use client";

import { useEffect, useState } from "react";
import { TOPIC_FEEDBACK_PREFIX } from "@/domain/mapa/reportTopics";

export function ApproverTopicEditor({
  topicKey,
  label,
  value,
  phrases = [],
  feedback,
  editFormId,
  rejectFormId,
}: {
  topicKey: string;
  label: string;
  value: string;
  phrases?: Array<{ code: string; text: string }>;
  feedback?: string;
  editFormId: string;
  rejectFormId: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <div className="print:hidden mt-2 space-y-2">
      <label className="block">
        <span className="sr-only">Texto de {label}</span>
        <textarea
          className="w-full rounded-md border border-teal-300 bg-teal-50/80 px-2 py-1.5 text-[11px] leading-relaxed text-slate-900"
          form={editFormId}
          name={topicKey}
          onChange={(event) => setText(event.target.value)}
          rows={Math.min(8, Math.max(3, Math.ceil(text.length / 90)))}
          value={text}
        />
      </label>
      {phrases.length > 0 ? (
        <select
          className="w-full rounded border border-teal-200 bg-white px-2 py-1 text-[11px]"
          onChange={(event) => {
            const next = event.target.value;
            if (next) setText(next);
          }}
          value=""
        >
          <option value="">Aplicar frase pré-definida…</option>
          {phrases.map((phrase) => (
            <option key={phrase.code} value={phrase.text}>
              {phrase.text}
            </option>
          ))}
        </select>
      ) : null}
      <p className="text-[10px] text-slate-500">
        Edite o texto, aplique uma frase pronta, ou deixe um feedback para devolver.
      </p>
      <div className="rounded-md border border-dashed border-rose-300 bg-rose-50/50 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">
          Devolver com feedback — {label}
        </p>
        <textarea
          className="mt-1 w-full rounded border border-rose-200 bg-white px-2 py-1 text-[11px]"
          defaultValue={feedback}
          form={rejectFormId}
          name={`${TOPIC_FEEDBACK_PREFIX}${topicKey}`}
          placeholder="Descreva o que precisa ser corrigido neste tópico"
          rows={2}
        />
      </div>
    </div>
  );
}
