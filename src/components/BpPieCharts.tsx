import { formatTime } from "@/lib/dates";

export type PieChartPoint = {
  at: Date;
  systolic: number;
  diastolic: number;
  heartRate?: number;
};

export type PieBandKey = "above" | "normal" | "below";

export type PieSegment = {
  key: PieBandKey;
  count: number;
  percent: number;
};

export type PieSeriesStats = {
  max: { value: number; at: Date } | null;
  min: { value: number; at: Date } | null;
  mean: number | null;
};

export type PieSeriesBands = {
  high: number;
  low: number;
  unit: string;
};

export type PieSeriesConfig = {
  key: "systolic" | "diastolic" | "heartRate";
  label: string;
  bands: PieSeriesBands;
};

const COLORS: Record<PieBandKey, string> = {
  above: "#ff0000",
  normal: "#00e000",
  below: "#ffff00",
};

const DRAW_ORDER: PieBandKey[] = ["normal", "above", "below"];

export function buildPieSegments(
  values: number[],
  low: number,
  high: number,
): PieSegment[] {
  let above = 0;
  let normal = 0;
  let below = 0;

  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value > high) above += 1;
    else if (value < low) below += 1;
    else normal += 1;
  }

  const total = above + normal + below;
  const toSegment = (key: PieBandKey, count: number): PieSegment => ({
    key,
    count,
    percent: total > 0 ? (count / total) * 100 : 0,
  });

  return [
    toSegment("above", above),
    toSegment("normal", normal),
    toSegment("below", below),
  ];
}

export function buildPieSeriesStats(
  items: Array<{ value: number; at: Date }>,
): PieSeriesStats {
  if (items.length === 0) {
    return { max: null, min: null, mean: null };
  }

  let max = items[0];
  let min = items[0];
  let sum = 0;
  for (const item of items) {
    sum += item.value;
    if (item.value > max.value) max = item;
    if (item.value < min.value) min = item;
  }

  return {
    max: { value: max.value, at: max.at },
    min: { value: min.value, at: min.at },
    mean: sum / items.length,
  };
}

export function buildPieSeriesConfigs(thresholds: {
  systolicHigh: number;
  diastolicHigh: number;
}): PieSeriesConfig[] {
  return [
    {
      key: "systolic",
      label: "Sistólica(mmHg)",
      bands: { high: thresholds.systolicHigh, low: 100, unit: "mmHg" },
    },
    {
      key: "diastolic",
      label: "Diastólica(mmHg)",
      bands: { high: thresholds.diastolicHigh, low: 60, unit: "mmHg" },
    },
    {
      key: "heartRate",
      label: "Frequência cardíaca(BPM)",
      bands: { high: 100, low: 60, unit: "BPM" },
    },
  ];
}

function pickItems(
  points: PieChartPoint[],
  key: PieSeriesConfig["key"],
): Array<{ value: number; at: Date }> {
  if (key === "heartRate") {
    return points
      .filter(
        (point) => point.heartRate != null && Number.isFinite(point.heartRate),
      )
      .map((point) => ({ value: point.heartRate as number, at: point.at }));
  }
  return points
    .filter((point) => Number.isFinite(point[key]))
    .map((point) => ({ value: point[key], at: point.at }));
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeSlice(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function formatMean(value: number): string {
  return value.toFixed(2);
}

function formatExtreme(value: number, at: Date, unit: string): string {
  return `${Math.round(value)}(${unit})(${formatTime(at)})`;
}

function PieSvg({
  segments,
  size,
}: {
  segments: PieSegment[];
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2;
  const visible = DRAW_ORDER.map(
    (key) => segments.find((segment) => segment.key === key)!,
  ).filter((segment) => segment.percent > 0);

  if (visible.length === 0) {
    return (
      <svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={cx} cy={cy} fill="#f3f3f3" r={radius} stroke="#000" />
      </svg>
    );
  }

  if (visible.length === 1) {
    const only = visible[0];
    return (
      <svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle
          cx={cx}
          cy={cy}
          fill={COLORS[only.key]}
          r={radius}
          stroke="#000"
          strokeWidth={1}
        />
        <text
          fill="#000"
          fontFamily="Times New Roman, Times, serif"
          fontSize={11}
          textAnchor="middle"
          x={cx}
          y={cy + 4}
        >
          {only.percent.toFixed(1)}%
        </text>
      </svg>
    );
  }

  let angle = 0;
  const slices = visible.map((segment) => {
    const sweep = (segment.percent / 100) * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    const mid = startAngle + sweep / 2;
    angle = endAngle;
    const labelPos = polarToCartesian(cx, cy, radius * 0.58, mid);
    return { segment, startAngle, endAngle, labelPos };
  });

  return (
    <svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
      {slices.map(({ segment, startAngle, endAngle }) => (
        <path
          d={describeSlice(cx, cy, radius, startAngle, endAngle)}
          fill={COLORS[segment.key]}
          key={segment.key}
          stroke="#000"
          strokeWidth={1}
        />
      ))}
      {slices.map(({ segment, labelPos }) =>
        segment.percent >= 4 ? (
          <text
            fill="#000"
            fontFamily="Times New Roman, Times, serif"
            fontSize={10}
            key={`label-${segment.key}`}
            textAnchor="middle"
            x={labelPos.x}
            y={labelPos.y + 3}
          >
            {segment.percent.toFixed(1)}%
          </text>
        ) : null,
      )}
    </svg>
  );
}

function Legend({ bands }: { bands: PieSeriesBands }) {
  const rows: Array<{ key: PieBandKey; mid: string; right: string }> = [
    { key: "above", mid: String(bands.high), right: "Acima" },
    {
      key: "normal",
      mid: `${bands.low}-${bands.high}`,
      right: bands.unit,
    },
    { key: "below", mid: String(bands.low), right: "Abaixo" },
  ];

  return (
    <div className="grid grid-cols-[14px_minmax(4.5rem,auto)_auto] items-center gap-x-2 gap-y-1.5 text-sm sm:text-base">
      {rows.map((row) => (
        <div className="contents" key={row.key}>
          <span
            aria-hidden
            className="inline-block h-3 w-3 border border-black"
            style={{ backgroundColor: COLORS[row.key] }}
          />
          <span>{row.mid}</span>
          <span>{row.right}</span>
        </div>
      ))}
    </div>
  );
}

function SeriesRow({
  config,
  points,
  pieSize,
}: {
  config: PieSeriesConfig;
  points: PieChartPoint[];
  pieSize: number;
}) {
  const items = pickItems(points, config.key);
  if (items.length === 0) return null;

  const stats = buildPieSeriesStats(items);
  const segments = buildPieSegments(
    items.map((item) => item.value),
    config.bands.low,
    config.bands.high,
  );
  const unit = config.bands.unit;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 sm:gap-6 sm:py-4">
      <div className="justify-self-start text-sm leading-relaxed sm:text-base">
        <p>
          Máximo:{" "}
          {stats.max ? formatExtreme(stats.max.value, stats.max.at, unit) : "—"}
        </p>
        <p>
          Mínimo:{" "}
          {stats.min ? formatExtreme(stats.min.value, stats.min.at, unit) : "—"}
        </p>
        <p>
          {config.key === "heartRate" ? "Média" : "Médias"}:{" "}
          {stats.mean != null ? `${formatMean(stats.mean)}(${unit})` : "—"}
        </p>
      </div>

      <div className="flex flex-col items-center">
        <PieSvg segments={segments} size={pieSize} />
        <p className="mt-1 text-center text-sm font-medium sm:text-base">{config.label}</p>
      </div>

      <div className="justify-self-end text-sm sm:text-base">
        <Legend bands={config.bands} />
      </div>
    </div>
  );
}

export function BpPieCharts({
  points,
  systolicHigh,
  diastolicHigh,
  variant = "screen",
}: {
  points: PieChartPoint[];
  systolicHigh: number;
  diastolicHigh: number;
  variant?: "screen" | "print";
}) {
  if (points.length === 0) return null;

  const configs = buildPieSeriesConfigs({ systolicHigh, diastolicHigh });
  const pieSize = variant === "print" ? 190 : 240;
  const isPrint = variant === "print";

  return (
    <figure className={isPrint ? "w-full" : "w-full"}>
      <figcaption
        className={
          isPrint
            ? "mb-2 text-center text-sm font-bold"
            : "mb-4 text-center text-lg font-semibold"
        }
      >
        Gráfico de pizza(Todos)
      </figcaption>
      <div className="divide-y divide-transparent">
        {configs.map((config) => (
          <SeriesRow
            config={config}
            key={config.key}
            pieSize={pieSize}
            points={points}
          />
        ))}
      </div>
    </figure>
  );
}
