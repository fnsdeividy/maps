import { prisma } from "@/lib/prisma";
import { isApprover, requireUser } from "@/lib/authz";
import { PHRASE_CATEGORIES } from "@/domain/mapa/phraseCategories";
import type { PhraseCategory } from "@/domain/mapa/types/clinical";
import { createPhraseAction, updatePhraseAction } from "./actions";

export const dynamic = "force-dynamic";

// Medicações são factuais (uso relatado), não entram na seleção de frases.
const MANAGEABLE_CATEGORIES = PHRASE_CATEGORIES.filter(
  (category) => category.value !== "MEDICATION",
);

function hasPlaceholder(text: string): boolean {
  return /\{[a-zA-Z]+\}/.test(text);
}

export default async function PhrasesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const canManage = isApprover(user.role);
  const { ok, error } = await searchParams;

  const phrases = await prisma.reportPhrase.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  const byCategory = new Map<PhraseCategory, typeof phrases>();
  for (const phrase of phrases) {
    const category = phrase.category as PhraseCategory;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(phrase);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Frases do laudo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Frases padronizadas por tópico. A IA escolhe as que melhor se
            enquadram em cada exame; se nenhuma servir, redige uma frase própria.
          </p>
        </div>
      </div>

      {ok ? (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Frase {ok === "criada" ? "criada" : "salva"} com sucesso.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          Preencha a categoria e o texto da frase.
        </p>
      ) : null}

      {!canManage ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Apenas o aprovador pode adicionar ou editar frases.
        </p>
      ) : (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Nova frase</h2>
          <form action={createPhraseAction} className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Tópico</span>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                name="category"
                defaultValue={MANAGEABLE_CATEGORIES[0].value}
              >
                {MANAGEABLE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Texto</span>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                name="text"
                placeholder="Ex.: Exame com valores compatíveis com Normotensão Arterial Verdadeira."
                rows={2}
                required
              />
            </label>
            <button className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white" type="submit">
              Adicionar frase
            </button>
          </form>
        </section>
      )}

      <div className="mt-8 space-y-8">
        {MANAGEABLE_CATEGORIES.map((category) => {
          const items = byCategory.get(category.value) ?? [];
          return (
            <section key={category.value}>
              <h2 className="border-b border-slate-200 pb-1 text-lg font-semibold">
                {category.label}{" "}
                <span className="text-sm font-normal text-slate-400">
                  ({items.length})
                </span>
              </h2>
              <div className="mt-3 space-y-3">
                {items.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma frase cadastrada.</p>
                ) : null}
                {items.map((phrase) => (
                  <form
                    key={phrase.code}
                    action={updatePhraseAction.bind(null, phrase.code)}
                    className={`rounded-lg border p-4 text-sm ${
                      phrase.active
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-slate-50 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs text-slate-400">{phrase.code}</code>
                      {hasPlaceholder(phrase.text) ? (
                        <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                          números do cálculo
                        </span>
                      ) : null}
                    </div>
                    <textarea
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      defaultValue={phrase.text}
                      disabled={!canManage}
                      name="text"
                      rows={2}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      <label className="text-xs">
                        <span className="mr-1 font-medium">Tópico</span>
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1"
                          defaultValue={phrase.category}
                          disabled={!canManage}
                          name="category"
                        >
                          {MANAGEABLE_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          defaultChecked={phrase.active}
                          disabled={!canManage}
                          name="active"
                          type="checkbox"
                        />
                        Ativa
                      </label>
                      {canManage ? (
                        <button
                          className="ml-auto rounded-md border border-slate-300 px-3 py-1"
                          type="submit"
                        >
                          Salvar
                        </button>
                      ) : null}
                    </div>
                  </form>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Frases marcadas como “números do cálculo” contêm valores entre chaves
        (ex.: {"{systolic}"}). Esses números são preenchidos automaticamente
        pelo sistema — nunca pela IA.
      </p>
    </div>
  );
}
