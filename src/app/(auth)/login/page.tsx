"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

type LoginState = { error: string } | null;

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null as LoginState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        action={action}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <p className="text-xs uppercase tracking-widest text-teal-700">MAPA</p>
        <h1 className="mt-1 text-2xl font-semibold">Acesso do médico</h1>
        <p className="mt-2 text-sm text-slate-500">Uso interno</p>
        <label className="mt-6 block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            name="email"
            required
            type="email"
          />
        </label>
        <label className="mt-4 block text-sm">
          Senha
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            name="password"
            required
            type="password"
          />
        </label>
        {state?.error ? (
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        ) : null}
        <button
          className="mt-6 w-full rounded-md bg-teal-700 px-4 py-2 text-white hover:bg-teal-800"
          type="submit"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
