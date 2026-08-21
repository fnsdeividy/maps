"use client";

import { useActionState, useState } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

function PasswordField({
  label,
  name,
  autoComplete,
  hint,
}: {
  label: string;
  name: string;
  autoComplete: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className="w-full rounded-md border border-slate-300 px-3 py-2 pr-20"
          minLength={name === "currentPassword" ? undefined : 8}
          name={name}
          required
          type={visible ? "text" : "password"}
        />
        <button
          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-teal-700 hover:text-teal-900"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    null as ChangePasswordState | null,
  );

  return (
    <form action={action} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="font-semibold">Alterar senha</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use a senha provisória enviada no primeiro acesso e escolha uma senha nova.
        </p>
      </div>

      {state?.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Senha atualizada com sucesso.
        </p>
      ) : null}

      <PasswordField
        autoComplete="current-password"
        label="Senha atual"
        name="currentPassword"
      />
      <PasswordField
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
        label="Nova senha"
        name="newPassword"
      />
      <PasswordField
        autoComplete="new-password"
        label="Confirmar nova senha"
        name="confirmPassword"
      />

      <button
        className="rounded-md bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
