"use client";

import { useActionState } from "react";
import {
  removeDoctorCertificateAction,
  saveDoctorCertificateAction,
  type CertificateState,
} from "./actions";

export function DoctorCertificateForm({
  commonName,
  issuer,
  notAfter,
}: {
  commonName: string | null;
  issuer: string | null;
  notAfter: string | null;
}) {
  const [saveState, saveAction, saving] = useActionState(
    saveDoctorCertificateAction,
    null as CertificateState | null,
  );
  const [removeState, removeAction, removing] = useActionState(
    removeDoctorCertificateAction,
    null as CertificateState | null,
  );

  const registered = Boolean(commonName);
  const error = saveState?.error ?? removeState?.error;
  const success = saveState?.success || removeState?.success;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Certificado digital (ICP-Brasil A1)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Envie o arquivo .pfx ou .p12 do seu certificado de médico. A senha é
          usada só para validar e assinar — ela não é gravada. Tokens A3
          (cartão/token USB) não são suportados neste cadastro.
        </p>
      </div>

      {registered ? (
        <dl className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <div>
            <dt className="text-xs uppercase tracking-wide">Titular</dt>
            <dd className="font-medium">{commonName}</dd>
          </div>
          {issuer ? (
            <div className="mt-1">
              <dt className="text-xs uppercase tracking-wide">Emissor</dt>
              <dd>{issuer}</dd>
            </div>
          ) : null}
          {notAfter ? (
            <div className="mt-1">
              <dt className="text-xs uppercase tracking-wide">Válido até</dt>
              <dd>{notAfter}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nenhum certificado cadastrado. Sem ele, a aprovação do laudo não gera
          assinatura digital.
        </p>
      )}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {registered && saveState?.success
            ? "Certificado atualizado."
            : removeState?.success
              ? "Certificado removido."
              : "Certificado cadastrado."}
        </p>
      ) : null}

      <form action={saveAction} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Arquivo .pfx ou .p12</span>
          <input
            accept=".pfx,.p12,application/x-pkcs12"
            className="w-full text-sm"
            name="certificate"
            required
            type="file"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Senha do certificado</span>
          <input
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            name="password"
            required
            type="password"
          />
        </label>
        <button
          className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={saving}
          type="submit"
        >
          {saving ? "Validando…" : registered ? "Substituir certificado" : "Cadastrar certificado"}
        </button>
      </form>

      {registered ? (
        <form action={removeAction}>
          <button
            className="text-sm text-red-700 underline disabled:opacity-50"
            disabled={removing}
            type="submit"
          >
            Remover certificado
          </button>
        </form>
      ) : null}
    </section>
  );
}
