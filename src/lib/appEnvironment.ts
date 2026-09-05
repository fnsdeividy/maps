export type AppEnvironment = "production" | "development" | "test";

function explicitEnv(value: string | undefined): AppEnvironment | null {
  if (value === "production" || value === "development" || value === "test") {
    return value;
  }
  if (value === "dev" || value === "local") return "development";
  if (value === "staging" || value === "preview") return "test";
  return null;
}

/**
 * Ambiente da aplicação para avisos visuais.
 * Produção só quando marcado explicitamente ou NODE_ENV=production sem override.
 */
export function resolveAppEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): AppEnvironment {
  const explicit =
    explicitEnv(env.APP_ENV) ??
    explicitEnv(env.NEXT_PUBLIC_APP_ENV) ??
    explicitEnv(env.VERCEL_ENV);
  if (explicit) return explicit;

  if (env.NODE_ENV !== "production") return "development";
  return "production";
}

export function environmentBannerLabel(env: AppEnvironment): string | null {
  if (env === "development") return "Ambiente de desenvolvimento";
  if (env === "test") return "Ambiente de teste";
  return null;
}
