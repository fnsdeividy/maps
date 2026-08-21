import { clockToMinutes } from "@/domain/mapa/import/awp/decoders/dateTime";

export type ChartPoint = {
  at: Date;
  systolic: number;
  diastolic: number;
  heartRate?: number;
};

export type ChartSleepWindow = {
  start: string;
  end: string;
};

export type ChartPressureLimits = {
  awake: { systolic: number; diastolic: number };
  sleep: { systolic: number; diastolic: number };
};

const SCREEN = {
  width: 1100,
  height: 480,
  padding: { top: 36, right: 64, bottom: 72, left: 58 },
};
const PRINT = {
  width: 740,
  height: 420,
  padding: { top: 34, right: 56, bottom: 66, left: 52 },
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function buildPath(
  points: Array<{ x: number; y: number }>,
): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function buildOptionalSeriesPath(
  points: ChartPoint[],
  pick: (point: ChartPoint) => number | undefined,
  scaleX: (at: Date | number) => number,
  scaleY: (value: number) => number,
): string {
  const coords: Array<{ x: number; y: number }> = [];
  const parts: string[] = [];
  let drawing = false;
  for (const point of points) {
    const value = pick(point);
    if (value == null || !Number.isFinite(value)) {
      drawing = false;
      continue;
    }
    const x = scaleX(point.at);
    const y = scaleY(value);
    parts.push(`${drawing ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
    drawing = true;
    coords.push({ x, y });
  }
  return parts.join(" ");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatHourLabel(date: Date): string {
  // Medições AWP: wall-clock nos componentes UTC (não usar getHours local).
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function buildHourTicks(minTime: number, maxTime: number, maxTicks: number): Date[] {
  const span = Math.max(maxTime - minTime, HOUR_MS);
  const stepHours =
    [1, 2, 3, 4, 6, 8, 12].find((hours) => span / (hours * HOUR_MS) <= maxTicks) ?? 12;
  const step = stepHours * HOUR_MS;
  const first = Math.ceil(minTime / step) * step;
  const ticks: Date[] = [];
  for (let t = first; t <= maxTime + 1; t += step) {
    if (t >= minTime && t <= maxTime) ticks.push(new Date(t));
  }
  if (ticks.length === 0) return [new Date(minTime), new Date(maxTime)];
  return ticks;
}

export function buildSleepBands(
  minTime: number,
  maxTime: number,
  window: ChartSleepWindow,
): Array<{ from: number; to: number }> {
  const startMin = clockToMinutes(window.start);
  const endMin = clockToMinutes(window.end);
  if (startMin === undefined || endMin === undefined || startMin === endMin) {
    return [];
  }

  const bands: Array<{ from: number; to: number }> = [];
  const firstDay = new Date(minTime);
  firstDay.setHours(0, 0, 0, 0);
  let cursor = firstDay.getTime() - DAY_MS;
  const lastDay = new Date(maxTime);
  lastDay.setHours(0, 0, 0, 0);

  while (cursor <= lastDay.getTime()) {
    const day = new Date(cursor);
    const start = new Date(day);
    start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

    const end = new Date(day);
    if (startMin < endMin) {
      end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
    } else {
      end.setTime(day.getTime() + DAY_MS);
      end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
    }

    const from = Math.max(start.getTime(), minTime);
    const to = Math.min(end.getTime(), maxTime);
    if (to > from) bands.push({ from, to });
    cursor += DAY_MS;
  }

  return bands;
}

function isInSleepBands(time: number, bands: Array<{ from: number; to: number }>): boolean {
  return bands.some((band) => time >= band.from && time < band.to);
}

export type PressureZone = "above" | "normal";

/** Verde para o traçado normal; vermelho só onde passa da linha amarela. */
export const PRESSURE_ZONE_COLORS: Record<PressureZone, string> = {
  above: "#dc2626",
  normal: "#16a34a",
};

/** Valor acima do limiar → acima; valores baixos contam como normal (sem faixa inferior). */
export function classifyValueZone(
  value: number,
  threshold: number,
): PressureZone {
  return value > threshold ? "above" : "normal";
}

/** PAS ou PAD acima do limiar → acima; valores baixos contam como normal. */
export function classifyPressureZone(
  systolic: number,
  diastolic: number,
  high: { systolic: number; diastolic: number },
): PressureZone {
  if (systolic > high.systolic || diastolic > high.diastolic) return "above";
  return "normal";
}

type TrendPoint = { x: number; value: number; threshold: number };

/**
 * Segmentos da linha de tendência, cortados na linha amarela:
 * vermelho só onde o valor ultrapassa o limiar.
 */
export function buildThresholdTrendSegments(
  points: TrendPoint[],
): Array<{ x1: number; yValue1: number; x2: number; yValue2: number; zone: PressureZone }> {
  const segments: Array<{
    x1: number;
    yValue1: number;
    x2: number;
    yValue2: number;
    zone: PressureZone;
  }> = [];

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    // Limiar no meio do segmento (vigília/sono podem mudar entre pontos).
    const threshold = (prev.threshold + curr.threshold) / 2;
    const prevAbove = prev.value > threshold;
    const currAbove = curr.value > threshold;

    if (prevAbove === currAbove) {
      segments.push({
        x1: prev.x,
        yValue1: prev.value,
        x2: curr.x,
        yValue2: curr.value,
        zone: prevAbove ? "above" : "normal",
      });
      continue;
    }

    // Cruza a linha amarela: interpola o ponto de corte.
    const span = curr.value - prev.value;
    const t = span === 0 ? 0.5 : (threshold - prev.value) / span;
    const crossX = prev.x + (curr.x - prev.x) * t;
    segments.push({
      x1: prev.x,
      yValue1: prev.value,
      x2: crossX,
      yValue2: threshold,
      zone: prevAbove ? "above" : "normal",
    });
    segments.push({
      x1: crossX,
      yValue1: threshold,
      x2: curr.x,
      yValue2: curr.value,
      zone: currAbove ? "above" : "normal",
    });
  }

  return segments;
}

function limitsForTime(
  time: number,
  bands: Array<{ from: number; to: number }>,
  limits: ChartPressureLimits,
): { systolic: number; diastolic: number } {
  return isInSleepBands(time, bands) ? limits.sleep : limits.awake;
}

/** Linha de limiar em degraus: vigília → sono → vigília. */
function buildSteppedLimitPath(
  minTime: number,
  maxTime: number,
  bands: Array<{ from: number; to: number }>,
  awakeValue: number,
  sleepValue: number,
  scaleX: (at: number) => number,
  scaleY: (value: number) => number,
): string {
  const edges = [minTime, ...bands.flatMap((band) => [band.from, band.to]), maxTime]
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort((a, b) => a - b);

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const from = edges[i];
    const to = edges[i + 1];
    if (to <= from) continue;
    const mid = (from + to) / 2;
    const value = isInSleepBands(mid, bands) ? sleepValue : awakeValue;
    const y = scaleY(value);
    points.push({ x: scaleX(from), y });
    points.push({ x: scaleX(to), y });
  }
  return buildPath(points);
}

function niceStep(span: number, targetTicks: number): number {
  const rough = span / targetTicks;
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const normalized = rough / power;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
}

function buildAxisTicks(min: number, max: number, targetTicks: number): number[] {
  const step = niceStep(max - min, targetTicks);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + 0.001; value += step) {
    ticks.push(Math.round(value));
  }
  return ticks;
}

/** Gráfico no estilo CONTEC: linhas PAS/PAD, FC e limiares. */
export function BpTimeChart({
  points,
  variant = "screen",
  sleepWindow,
  limits,
}: {
  points: ChartPoint[];
  variant?: "screen" | "print";
  sleepWindow?: ChartSleepWindow | null;
  limits?: ChartPressureLimits | null;
}) {
  if (points.length < 2) return null;

  const { width: WIDTH, height: HEIGHT, padding: PADDING } =
    variant === "print" ? PRINT : SCREEN;

  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const times = sorted.map((point) => point.at.getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const pressureValues = sorted.flatMap((point) => [point.systolic, point.diastolic]);
  if (limits) {
    pressureValues.push(
      limits.awake.systolic,
      limits.awake.diastolic,
      limits.sleep.systolic,
      limits.sleep.diastolic,
    );
  }
  let minPressure = Math.min(10, Math.floor(Math.min(...pressureValues) / 10) * 10);
  let maxPressure = Math.max(210, Math.ceil(Math.max(...pressureValues) / 10) * 10);
  if (maxPressure - minPressure < 100) maxPressure = minPressure + 200;

  const heartRates = sorted
    .map((point) => point.heartRate)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const hasHeartRate = heartRates.length >= 2;
  const minHr = 40;
  const maxHr = Math.max(240, hasHeartRate ? Math.ceil(Math.max(...heartRates) / 10) * 10 : 240);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const axisY = PADDING.top + plotHeight;

  const scaleX = (at: Date | number) => {
    const ms = typeof at === "number" ? at : at.getTime();
    return (
      PADDING.left +
      (maxTime === minTime ? 0 : ((ms - minTime) / (maxTime - minTime)) * plotWidth)
    );
  };
  const scalePressure = (value: number) =>
    PADDING.top +
    plotHeight -
    ((value - minPressure) / (maxPressure - minPressure)) * plotHeight;
  const scaleHr = (value: number) =>
    PADDING.top + plotHeight - ((value - minHr) / (maxHr - minHr)) * plotHeight;

  const pressureTicks = buildAxisTicks(minPressure, maxPressure, 12);
  const hrTicks = hasHeartRate ? buildAxisTicks(minHr, maxHr, 10) : [];
  const hourTicks = buildHourTicks(minTime, maxTime, variant === "print" ? 12 : 10);
  const sleepBands = sleepWindow ? buildSleepBands(minTime, maxTime, sleepWindow) : [];
  const isPrint = variant === "print";

  const defaultHigh = limits?.awake ?? { systolic: 135, diastolic: 85 };
  const pointHighs = sorted.map((point) =>
    limits ? limitsForTime(point.at.getTime(), sleepBands, limits) : defaultHigh,
  );

  const sysTrendSegments = buildThresholdTrendSegments(
    sorted.map((point, index) => ({
      x: scaleX(point.at),
      value: point.systolic,
      threshold: pointHighs[index].systolic,
    })),
  );
  const diaTrendSegments = buildThresholdTrendSegments(
    sorted.map((point, index) => ({
      x: scaleX(point.at),
      value: point.diastolic,
      threshold: pointHighs[index].diastolic,
    })),
  );
  const hrPath = hasHeartRate
    ? buildOptionalSeriesPath(sorted, (point) => point.heartRate, scaleX, scaleHr)
    : "";

  const sysLimitPath =
    limits && sleepBands.length > 0
      ? buildSteppedLimitPath(
          minTime,
          maxTime,
          sleepBands,
          limits.awake.systolic,
          limits.sleep.systolic,
          scaleX,
          scalePressure,
        )
      : limits
        ? `M${scaleX(minTime).toFixed(1)} ${scalePressure(limits.awake.systolic).toFixed(1)} L${scaleX(maxTime).toFixed(1)} ${scalePressure(limits.awake.systolic).toFixed(1)}`
        : "";
  const diaLimitPath =
    limits && sleepBands.length > 0
      ? buildSteppedLimitPath(
          minTime,
          maxTime,
          sleepBands,
          limits.awake.diastolic,
          limits.sleep.diastolic,
          scaleX,
          scalePressure,
        )
      : limits
        ? `M${scaleX(minTime).toFixed(1)} ${scalePressure(limits.awake.diastolic).toFixed(1)} L${scaleX(maxTime).toFixed(1)} ${scalePressure(limits.awake.diastolic).toFixed(1)}`
        : "";

  const midnight = hourTicks.find(
    (tick) => tick.getUTCHours() === 0 && tick.getUTCMinutes() === 0,
  );

  return (
    <figure className={isPrint ? "print-keep w-full" : "w-full overflow-x-auto"}>
      <svg
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title>BP Tendência vs Tempo</title>

        <text
          fill="#0f172a"
          fontSize={isPrint ? "14" : "18"}
          fontWeight="600"
          textAnchor="middle"
          x={WIDTH / 2}
          y={isPrint ? 18 : 22}
        >
          BP Tendência vs Tempo
        </text>

        {/* Noite (cinza) */}
        {sleepBands.map((band) => (
          <rect
            fill="#94a3b8"
            fillOpacity={isPrint ? 0.28 : 0.22}
            height={plotHeight}
            key={`sleep-${band.from}-${band.to}`}
            width={Math.max(scaleX(band.to) - scaleX(band.from), 1)}
            x={scaleX(band.from)}
            y={PADDING.top}
          />
        ))}

        {/* Limiares clínicos (amarelo) */}
        {sysLimitPath ? (
          <path d={sysLimitPath} fill="none" stroke="#eab308" strokeWidth="1.5" />
        ) : null}
        {diaLimitPath ? (
          <path d={diaLimitPath} fill="none" stroke="#eab308" strokeWidth="1.5" />
        ) : null}

        {/* Linhas PAS / PAD: verde; vermelho só acima da linha amarela */}
        {sysTrendSegments.map((segment, index) => (
          <line
            key={`sys-trend-${index}`}
            stroke={PRESSURE_ZONE_COLORS[segment.zone]}
            strokeLinecap="round"
            strokeWidth={segment.zone === "above" ? (isPrint ? 1.6 : 2) : (isPrint ? 1.1 : 1.4)}
            x1={segment.x1}
            x2={segment.x2}
            y1={scalePressure(segment.yValue1)}
            y2={scalePressure(segment.yValue2)}
          />
        ))}
        {diaTrendSegments.map((segment, index) => (
          <line
            key={`dia-trend-${index}`}
            stroke={PRESSURE_ZONE_COLORS[segment.zone]}
            strokeLinecap="round"
            strokeWidth={segment.zone === "above" ? (isPrint ? 1.6 : 2) : (isPrint ? 1.1 : 1.4)}
            x1={segment.x1}
            x2={segment.x2}
            y1={scalePressure(segment.yValue1)}
            y2={scalePressure(segment.yValue2)}
          />
        ))}

        {/* FC */}
        {hrPath ? (
          <path d={hrPath} fill="none" stroke="#2563eb" strokeWidth="1.25" />
        ) : null}

        {/* Eixos */}
        <line
          stroke="#334155"
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={axisY}
          y2={axisY}
        />
        <line
          stroke="#334155"
          x1={PADDING.left}
          x2={PADDING.left}
          y1={PADDING.top}
          y2={axisY}
        />
        {hasHeartRate ? (
          <line
            stroke="#2563eb"
            x1={WIDTH - PADDING.right}
            x2={WIDTH - PADDING.right}
            y1={PADDING.top}
            y2={axisY}
          />
        ) : null}

        {/* Rótulos eixo Y esquerdo (mmHg) */}
        {pressureTicks.map((value) => (
          <text
            fill="#334155"
            fontSize={isPrint ? "10" : "12"}
            key={`bp-label-${value}`}
            textAnchor="end"
            x={PADDING.left - 6}
            y={scalePressure(value) + 3}
          >
            {value}
          </text>
        ))}
        <text
          fill="#334155"
          fontSize={isPrint ? "11" : "13"}
          transform={`rotate(-90 ${16} ${PADDING.top + plotHeight / 2})`}
          x={16}
          y={PADDING.top + plotHeight / 2}
        >
          BP [mmHg]
        </text>

        {/* Rótulos eixo Y direito (bpm) */}
        {hrTicks.map((value) => (
          <text
            fill="#2563eb"
            fontSize={isPrint ? "10" : "12"}
            key={`hr-label-${value}`}
            x={WIDTH - PADDING.right + 6}
            y={scaleHr(value) + 3}
          >
            {value}
          </text>
        ))}
        {hasHeartRate ? (
          <text
            fill="#2563eb"
            fontSize={isPrint ? "11" : "13"}
            transform={`rotate(90 ${WIDTH - 14} ${PADDING.top + plotHeight / 2})`}
            x={WIDTH - 14}
            y={PADDING.top + plotHeight / 2}
          >
            Frequência cardíaca [BPM]
          </text>
        ) : null}

        {/* Eixo X */}
        {hourTicks.map((tick) => (
          <g key={`x-${tick.getTime()}`}>
            <line
              stroke="#334155"
              x1={scaleX(tick)}
              x2={scaleX(tick)}
              y1={axisY}
              y2={axisY + 4}
            />
            <text
              fill="#334155"
              fontSize={isPrint ? "10" : "12"}
              textAnchor="middle"
              x={scaleX(tick)}
              y={axisY + 16}
            >
              {formatHourLabel(tick)}
            </text>
          </g>
        ))}
        {midnight ? (
          <text
            fill="#334155"
            fontSize={isPrint ? "10" : "12"}
            textAnchor="middle"
            x={scaleX(midnight)}
            y={axisY + 30}
          >
            {midnight.getUTCFullYear()}/{midnight.getUTCMonth() + 1}/{midnight.getUTCDate()}
          </text>
        ) : null}
        <text
          fill="#334155"
          fontSize={isPrint ? "11" : "13"}
          textAnchor="end"
          x={WIDTH - PADDING.right}
          y={HEIGHT - 10}
        >
          Tempo
        </text>
      </svg>

      <figcaption
        className={`mt-3 flex flex-wrap items-center gap-4 ${isPrint ? "text-[11px] text-black" : "text-sm text-slate-600"}`}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 border border-slate-300 bg-white" />
          Dia
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 bg-slate-400/40" />
          Noite
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-bold text-green-600">—</span>
          PAS / PAD normal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-bold text-red-600">—</span>
          Acima da linha amarela
        </span>
        <span className="text-blue-600">— FC</span>
        {limits ? <span className="text-yellow-700">— Limiares vigília/sono</span> : null}
        {sleepWindow ? (
          <span>
            Sono {sleepWindow.start}–{sleepWindow.end}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
