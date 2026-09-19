import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  SCHEDULE_DAYS,
  SCHEDULE_END_HOUR,
  SCHEDULE_SLOT_MINUTES,
  SCHEDULE_START_HOUR,
  startOfScheduleWeek,
  toScheduleDate,
  toScheduleTime,
} from "@/domain/schedule";

const WEEKDAY_LABELS = ["SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerado",
  PENDING_APPROVAL: "Aguardando aprovação",
  CHANGES_REQUESTED: "Com pendências",
  APPROVED: "Aprovado",
};

function addUtcDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatShortDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatWeekRange(start: Date): string {
  const end = addUtcDays(start, SCHEDULE_DAYS - 1);
  return `${formatShortDate(start)} – ${formatShortDate(end)} de ${end.getUTCFullYear()}`;
}

function scheduleSlots(): string[] {
  const slots: string[] = [];
  for (
    let minutes = SCHEDULE_START_HOUR * 60;
    minutes < SCHEDULE_END_HOUR * 60;
    minutes += SCHEDULE_SLOT_MINUTES
  ) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    slots.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  }
  return slots;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekStart = startOfScheduleWeek(week);
  const weekEnd = addUtcDays(weekStart, 7);
  const days = Array.from({ length: SCHEDULE_DAYS }, (_, index) =>
    addUtcDays(weekStart, index),
  );
  const slots = scheduleSlots();
  const reports = await prisma.mapaReport.findMany({
    where: {
      active: true,
      scheduledAt: { gte: weekStart, lt: weekEnd },
    },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      patient: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  const reportsBySlot = new Map(
    reports
      .filter((report) => report.scheduledAt)
      .map((report) => [report.scheduledAt!.toISOString(), report]),
  );
  const occupiedByDay = new Map<string, number>();
  for (const report of reports) {
    if (!report.scheduledAt) continue;
    const date = toScheduleDate(report.scheduledAt);
    occupiedByDay.set(date, (occupiedByDay.get(date) ?? 0) + 1);
  }

  const previousWeek = toScheduleDate(addUtcDays(weekStart, -7));
  const nextWeek = toScheduleDate(addUtcDays(weekStart, 7));
  const currentWeek = toScheduleDate(startOfScheduleWeek());

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="mt-1 text-sm text-slate-500">
            Clique em uma vaga para cadastrar o paciente e criar o laudo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            href={`/agenda?week=${currentWeek}`}
          >
            Hoje
          </Link>
          <Link
            aria-label="Semana anterior"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50"
            href={`/agenda?week=${previousWeek}`}
          >
            ‹
          </Link>
          <Link
            aria-label="Próxima semana"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50"
            href={`/agenda?week=${nextWeek}`}
          >
            ›
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold capitalize">{formatWeekRange(weekStart)}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Intervalos de 30 minutos · 07:00 às 19:00
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[72px_repeat(6,minmax(145px,1fr))] border-b border-slate-200">
              <div className="border-r border-slate-100" />
              {days.map((day, index) => {
                const date = toScheduleDate(day);
                const vacancies = slots.length - (occupiedByDay.get(date) ?? 0);
                return (
                  <div
                    className="border-r border-slate-100 px-3 py-4 text-center last:border-r-0"
                    key={date}
                  >
                    <p className="text-xs font-semibold text-slate-400">
                      {WEEKDAY_LABELS[index]}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{day.getUTCDate()}</p>
                    <p className="mt-1 text-xs font-medium text-teal-700">
                      {vacancies} {vacancies === 1 ? "vaga" : "vagas"}
                    </p>
                  </div>
                );
              })}
            </div>

            {slots.map((time) => (
              <div
                className="grid grid-cols-[72px_repeat(6,minmax(145px,1fr))]"
                key={time}
              >
                <div className="border-b border-r border-slate-100 px-3 py-3 text-xs text-slate-400">
                  {time}
                </div>
                {days.map((day) => {
                  const date = toScheduleDate(day);
                  const scheduledAt = new Date(`${date}T${time}:00.000Z`);
                  const report = reportsBySlot.get(scheduledAt.toISOString());
                  return report ? (
                    <Link
                      className="min-h-14 border-b border-r border-slate-100 bg-teal-50 px-3 py-2 text-xs hover:bg-teal-100"
                      href={`/reports/${report.id}`}
                      key={date}
                    >
                      <span className="block truncate font-semibold text-teal-950">
                        {report.patient.name}
                      </span>
                      <span className="mt-1 block text-teal-700">
                        {STATUS_LABELS[report.status] ?? report.status}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      aria-label={`Criar laudo em ${date} às ${time}`}
                      className="group min-h-14 border-b border-r border-slate-100 px-3 py-2 text-xs hover:bg-teal-50"
                      href={`/reports/new?scheduledDate=${date}&scheduledTime=${time}`}
                      key={date}
                    >
                      <span className="hidden text-teal-700 group-hover:inline">+ Criar</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
