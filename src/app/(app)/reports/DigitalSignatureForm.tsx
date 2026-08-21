import Link from "next/link";

export function DigitalSignatureForm({
  action,
  hasCertificate,
  certificateCommonName,
  signedAt,
  signerCommonName,
  returnTo,
}: {
  action: (formData: FormData) => void;
  hasCertificate: boolean;
  certificateCommonName: string | null;
  signedAt: Date | null;
  signerCommonName: string | null;
  returnTo?: "print";
}) {
  const alreadySigned = Boolean(signedAt);

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5 text-sm print:hidden">
      <p className="font-semibold">Assinatura digital</p>
      {alreadySigned ? (
        <p className="mt-1 text-xs text-emerald-800">
          Assinado em{" "}
          {signedAt?.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
          {signerCommonName ? ` · ${signerCommonName}` : ""}. Você pode
          assinar de novo se o certificado mudou.
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Laudo aprovado ainda sem assinatura ICP-Brasil.
        </p>
      )}

      {hasCertificate ? (
        <form action={action} className="mt-3 space-y-3">
          {returnTo ? (
            <input name="returnTo" type="hidden" value={returnTo} />
          ) : null}
          <p className="text-xs text-slate-500">
            Certificado: {certificateCommonName}. A senha não é gravada.
          </p>
          <label className="block">
            <span className="text-slate-600">Senha do certificado</span>
            <input
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              name="certificatePassword"
              type="password"
            />
          </label>
          <button
            className="rounded-md bg-teal-700 px-4 py-2 text-white"
            type="submit"
          >
            {alreadySigned ? "Reassinar digitalmente" : "Assinar digitalmente"}
          </button>
        </form>
      ) : (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          Cadastre seu certificado A1 em{" "}
          <Link className="underline" href="/settings">
            Configurações
          </Link>{" "}
          para assinar este laudo.
        </p>
      )}
    </section>
  );
}
