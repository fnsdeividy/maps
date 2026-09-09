"use client";

import { useEffect, useRef, useState } from "react";
import { phrasesOf } from "@/domain/mapa/interpretation";
import { TOPIC_FEEDBACK_PREFIX } from "@/domain/mapa/reportTopics";

type EditablePhrase = {
  id: string;
  text: string;
};

const FREE_TEXT_OPTION = "__FREE_TEXT__";

function initialPhrases(value: string): EditablePhrase[] {
  return phrasesOf(value).map((text, index) => ({
    id: `initial-${index}`,
    text,
  }));
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
  const [items, setItems] = useState<EditablePhrase[]>(() =>
    initialPhrases(value),
  );
  const nextId = useRef(0);

  useEffect(() => {
    setItems(initialPhrases(value));
  }, [value]);

  function applyPhrase(code: string) {
    if (code === FREE_TEXT_OPTION) {
      setItems((current) => [
        ...current,
        { id: `free-${nextId.current++}`, text: "" },
      ]);
      return;
    }
    const phrase = phrases.find((item) => item.code === code);
    if (!phrase) return;
    const text = phrase.text.trim();
    if (!text) return;
    setItems((current) => {
      if (current.some((item) => item.text.trim() === text)) return current;
      return [
        ...current,
        { id: `added-${nextId.current++}`, text },
      ];
    });
  }

  function updatePhrase(id: string, text: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, text } : item)),
    );
  }

  function removePhrase(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="print:hidden mt-2 space-y-2">
      <input
        form={editFormId}
        name={topicKey}
        type="hidden"
        value={items
          .map((item) => item.text.trim())
          .filter(Boolean)
          .join("\n\n")}
      />
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            className="rounded-md border border-teal-300 bg-teal-50/80 p-2"
            key={item.id}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                {item.id.startsWith("free-")
                  ? "Outros — texto livre"
                  : `Frase ${index + 1}`}
              </span>
              <button
                className="text-[10px] font-medium text-red-700 underline"
                onClick={() => removePhrase(item.id)}
                type="button"
              >
                Remover
              </button>
            </div>
            <label className="block">
              <span className="sr-only">
                Frase {index + 1} de {label}
              </span>
              <textarea
                className="w-full resize-y bg-transparent text-[11px] leading-relaxed text-slate-900 outline-none"
                onChange={(event) =>
                  updatePhrase(item.id, event.target.value)
                }
                rows={Math.min(
                  8,
                  Math.max(2, Math.ceil(item.text.length / 90)),
                )}
                placeholder={
                  item.id.startsWith("free-")
                    ? "Escreva livremente..."
                    : undefined
                }
                value={item.text}
              />
            </label>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-teal-300 px-3 py-2 text-[11px] text-slate-500">
            Nenhuma frase. Selecione uma frase pré-definida abaixo.
          </p>
        ) : null}
      </div>
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
        <option value={FREE_TEXT_OPTION}>Outros — escrever texto livre…</option>
      </select>
      <p className="text-[10px] text-slate-500">
        Cada frase fica em um bloco separado. Edite o texto, acrescente outra
        frase pronta ou remova apenas o bloco que não quiser.
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
