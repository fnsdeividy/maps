"use client";

import { useEffect, useState } from "react";
import { TOPIC_FEEDBACK_PREFIX } from "@/domain/mapa/reportTopics";

function appendPhrase(current: string, phrase: string): string {
  const trimmed = current.trim();
  const next = phrase.trim();
  if (!next) return current;
  if (!trimmed) return next;
  if (trimmed.includes(next)) return trimmed;
  return `${trimmed}\n\n${next}`;
}

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
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!edited) setText(value);
  }, [value, edited]);

  function applyPhrase(code: string) {
    const phrase = phrases.find((item) => item.code === code);
    if (!phrase) return;
    setEdited(true);
    setText((current) => appendPhrase(current, phrase.text));
  }

  return (
    <div className="print:hidden mt-2 space-y-2">
      <label className="block">
        <span className="sr-only">Texto de {label}</span>
        <textarea
          className="w-full rounded-md border border-teal-300 bg-teal-50/80 px-2 py-1.5 text-[11px] leading-relaxed text-slate-900"
          form={editFormId}
          name={topicKey}
          onChange={(event) => {
            setEdited(true);
            setText(event.target.value);
          }}
          rows={Math.min(12, Math.max(3, Math.ceil(text.length / 90)))}
          value={text}
        />
      </label>
      {phrases.length > 0 ? (
        <select
          className="w-full rounded border border-teal-200 bg-white px-2 py-1 text-[11px]"
          defaultValue=""
          onChange={(event) => {
            const code = event.target.value;
            event.target.value = "";
            if (code) applyPhrase(code);
          }}
        >
          <option value="">Aplicar frase pré-definida…</option>
          {phrases.map((phrase) => (
            <option key={phrase.code} value={phrase.code}>
              {phrase.text}
            </option>
          ))}
        </select>
      ) : null}
      <p className="text-[10px] text-slate-500">
        Edite o texto, acrescente uma frase pronta ou deixe um feedback para
        devolver. A frase aplicada entra no final; apague o que não quiser.
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
