export type HistogramPoint = {
  systolic: number;
  diastolic: number;
  heartRate?: number;
};

export type HistogramBin = {
  start: number;
  end: number;
  count: number;
  percent: number;
};

export type HistogramSeriesConfig = {
  key: "systolic" | "diastolic" | "heartRate";
  label: string;
  min: number;
  max: number;
  step: number;
};

export const HISTOGRAM_SERIES: HistogramSeriesConfig[] = [
  { key: "systolic", label: "Sistólica(mmHg)", min: 80, max: 210, step: 10 },
  { key: "diastolic", label: "Diastólica(mmHg)", min: 40, max: 180, step: 10 },
  {
    key: "heartRate",
    label: "Frequência cardíaca(BPM)",
    min: 40,
    max: 180,
    step: 10,
  },
];

const PRINT = {
  width: 740,
  height: 210,
  padding: { top: 24, right: 14, bottom: 40, left: 40 },
};

const SCREEN = {
  width: 1100,
  height: 280,
  padding: { top: 28, right: 16, bottom: 44, left: 48 },
};

const HISTOGRAM_BAR_FILL = "#facc15";
const Y_TICKS = [0, 25, 50, 75, 100];

export function buildHistogramBins(
  values: number[],
  min: number,
  max: number,
  step: number,
): HistogramBin[] {
  const binCount = Math.round((max - min) / step);
  const counts = Array.from({ length: binCount }, () => 0);
  let total = 0;

  for (const raw of values) {
    if (!Number.isFinite(raw)) continue;
    total += 1;
    let index = Math.floor((raw - min) / step);
    if (raw >= max) index = binCount - 1;
    if (index < 0) index = 0;
    if (index >= binCount) index = binCount - 1;
    counts[index] += 1;
  }

  return counts.map((count, index) => {
    const start = min + index * step;
    const end = start + step;
    const percent = total > 0 ? (count / total) * 100 : 0;
    return { start, end, count, percent };
  });
}

function pickValues(
  points: HistogramPoint[],
  key: HistogramSeriesConfig["key"],
): number[] {
  if (key === "heartRate") {
    return points
      .map((point) => point.heartRate)
      .filter((value): value is number => value != null && Number.isFinite(value));
  }
  return points.map((point) => point[key]).filter((value) => Number.isFinite(value));
}

function formatPercentLabel(value: number): string {
  return `${value.toFixed(2)}%`;
}

function SingleHistogram({
  bins,
  config,
  variant,
}: {
  bins: HistogramBin[];
  config: HistogramSeriesConfig;
  variant: "screen" | "print";
}) {
  const layout = variant === "print" ? PRINT : SCREEN;
  const { width, height, padding } = layout;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barGap = 1;
  const barWidth = Math.max(2, plotW / bins.length - barGap);
  const isPrint = variant === "print";
  const fontSize = isPrint ? 9 : 12;
  const labelFont = isPrint ? 8 : 10;

  const scaleY = (percent: number) =>
    padding.top + plotH - (Math.min(100, Math.max(0, percent)) / 100) * plotH;

  const xTicks: number[] = [];
  for (let value = config.min; value <= config.max; value += config.step) {
    xTicks.push(value);
  }

  return (
    <svg
      aria-label={config.label}
      className="mx-auto block h-auto w-full max-w-full"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect
        fill="#fff"
        height={plotH}
        stroke="#000"
        strokeWidth={1}
        width={plotW}
        x={padding.left}
        y={padding.top}
      />

      {Y_TICKS.map((tick) => {
        const y = scaleY(tick);
        return (
          <g key={`y-${tick}`}>
            <line
              stroke="#000"
              strokeWidth={1}
              x1={padding.left - 4}
              x2={padding.left}
              y1={y}
              y2={y}
            />
            <text
              fill="#000"
              fontFamily="Times New Roman, Times, serif"
              fontSize={fontSize}
              textAnchor="end"
              x={padding.left - 6}
              y={y + 3}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {bins.map((bin, index) => {
        if (bin.count === 0) return null;
        const x = padding.left + index * (barWidth + barGap) + barGap / 2;
        const y = scaleY(bin.percent);
        const barH = Math.max(0, padding.top + plotH - y);
        const labelX = x + barWidth / 2;
        return (
          <g key={`bin-${bin.start}`}>
            <rect
              fill={HISTOGRAM_BAR_FILL}
              height={barH}
              stroke="#000"
              strokeWidth={0.6}
              width={barWidth}
              x={x}
              y={y}
            />
            <text
              fill="#000"
              fontFamily="Times New Roman, Times, serif"
              fontSize={labelFont}
              textAnchor="middle"
              x={labelX}
              y={Math.max(padding.top - 4, y - 3)}
            >
              {formatPercentLabel(bin.percent)}
            </text>
          </g>
        );
      })}

      {xTicks.map((tick, index) => {
        const x = padding.left + (index / (xTicks.length - 1)) * plotW;
        return (
          <g key={`x-${tick}`}>
            <line
              stroke="#000"
              strokeWidth={1}
              x1={x}
              x2={x}
              y1={padding.top + plotH}
              y2={padding.top + plotH + 4}
            />
            <text
              fill="#000"
              fontFamily="Times New Roman, Times, serif"
              fontSize={fontSize}
              textAnchor="middle"
              x={x}
              y={padding.top + plotH + 14}
            >
              {tick}
            </text>
          </g>
        );
      })}

      <text
        fill="#000"
        fontFamily="Times New Roman, Times, serif"
        fontSize={fontSize + 1}
        textAnchor="middle"
        x={padding.left + plotW / 2}
        y={height - 4}
      >
        {config.label}
      </text>
    </svg>
  );
}

export function BpHistogramCharts({
  points,
  variant = "screen",
}: {
  points: HistogramPoint[];
  variant?: "screen" | "print";
}) {
  if (points.length === 0) return null;

  const isPrint = variant === "print";

  return (
    <figure className={isPrint ? "print-keep" : "space-y-4"}>
      <figcaption
        className={
          isPrint
            ? "mb-1 text-center text-sm font-bold"
            : "mb-3 text-center text-lg font-semibold"
        }
      >
        Histograma(Todos)
      </figcaption>
      <div className={isPrint ? "space-y-1" : "space-y-4"}>
        {HISTOGRAM_SERIES.map((config) => {
          const values = pickValues(points, config.key);
          if (values.length === 0) return null;
          const bins = buildHistogramBins(values, config.min, config.max, config.step);
          return (
            <SingleHistogram
              bins={bins}
              config={config}
              key={config.key}
              variant={variant}
            />
          );
        })}
      </div>
    </figure>
  );
}
