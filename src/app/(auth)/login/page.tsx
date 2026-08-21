"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";

type LoginState = { error: string } | null;

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null as LoginState);
  const [showPassword, setShowPassword] = useState(false);

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
          <div className="relative mt-1">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-20"
              name="password"
              required
              type={showPassword ? "text" : "password"}
            />
            <button
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-teal-700 hover:text-teal-900"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
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
