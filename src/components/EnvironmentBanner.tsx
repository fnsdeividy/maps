import {
  environmentBannerLabel,
  resolveAppEnvironment,
} from "@/lib/appEnvironment";

export function EnvironmentBanner() {
  const label = environmentBannerLabel(resolveAppEnvironment());
  if (!label) return null;

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-[100] print:hidden">
      <span className="inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950 shadow-md">
        {label}
      </span>
    </div>
  );
}
