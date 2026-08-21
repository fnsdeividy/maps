"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

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

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Senha atual</span>
        <input
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          name="currentPassword"
          required
          type="password"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Nova senha</span>
        <input
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          minLength={8}
          name="newPassword"
          required
          type="password"
        />
        <span className="mt-1 block text-xs text-slate-500">Mínimo de 8 caracteres.</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Confirmar nova senha</span>
        <input
          autoComplete="new-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
      </label>

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
