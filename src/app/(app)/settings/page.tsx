import { getClinicSettings, countPendingSettings } from "@/services/settings/clinicSettings";
import { isApprover, requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DoctorCertificateForm } from "./DoctorCertificateForm";
import { SettingsForm } from "./SettingsForm";

const pendingDescriptions = [
  {
    key: "officeThresholds",
    label: "Limite de pressão de consultório para classificação office vs MAPA.",
  },
  {
    key: "significantlyElevatedThresholds",
    label: "Limite entre “elevado” e “significativamente elevado”.",
  },
  {
    key: "pressureLoadThresholds",
    label: "Limites de cargas pressóricas (normal vs elevada).",
  },
  {
    key: "nightDippingThresholds",
    label: "Valores de descenso noturno: normal / atenuado / acentuado / ausente.",
  },
  {
    key: "technicalQualityThresholds",
    label: "Percentual mínimo de medições válidas para qualidade técnica.",
  },
  {
    key: "pressurePeakThresholds",
    label: "Critérios objetivos para picos pressóricos automáticos.",
  },
] as const;

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getClinicSettings();
  const pending = pendingDescriptions.filter(
    (item) => settings.thresholds[item.key as keyof typeof settings.thresholds] == null,
  );
  const doctor = isApprover(user.role)
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          certificateCommonName: true,
          certificateIssuer: true,
          certificateNotAfter: true,
        },
      })
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">
          Conta e parâmetros clínicos do roteiro de laudo MAPA.
        </p>
      </div>

      <ChangePasswordForm />

      {isApprover(user.role) ? (
        <DoctorCertificateForm
          commonName={doctor?.certificateCommonName ?? null}
          issuer={doctor?.certificateIssuer ?? null}
          notAfter={
            doctor?.certificateNotAfter
              ? doctor.certificateNotAfter.toLocaleDateString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })
              : null
          }
        />
      ) : null}

      <div>
        <h2 className="text-lg font-semibold">Parâmetros clínicos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Alterações aplicam-se aos próximos laudos gerados.
        </p>
      </div>

      <SettingsForm
        guidelineFooter={settings.guidelineFooter}
        thresholds={settings.thresholds}
      />

      {pending.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold">Parâmetros ainda desativados</h2>
          <p className="mt-1 text-sm text-amber-900">
            {countPendingSettings(settings.thresholds)} parâmetro(s) opcional(is) ainda não
            configurado(s). Ative e preencha a seção correspondente acima quando validado pela
            clínica.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {pending.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
