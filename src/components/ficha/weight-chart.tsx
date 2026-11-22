import { formatISODate } from "@/lib/dates";
import { buildChart, type WeightPoint } from "@/lib/ficha/weights";
import { formatKg } from "@/lib/units";

/**
 * Gráfico de linha em SVG puro (Server Component, sem JavaScript no cliente).
 * Escolha: para uma série curta de pesagens uma biblioteca de gráficos só acrescentaria
 * peso ao bundle, e o SVG escala bem e herda as cores do design system.
 */
export function WeightChart({
  points,
  className,
}: {
  points: WeightPoint[];
  className?: string;
}) {
  const W = 340;
  const H = 180;
  const chart = buildChart(points, W, H, {
    top: 16,
    right: 14,
    bottom: 28,
    left: 14,
  });
  if (!chart) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Evolução do peso: de ${formatKg(first.kg)} em ${formatISODate(first.on)} a ${formatKg(last.kg)} em ${formatISODate(last.on)}`}
        className="h-auto w-full"
      >
        <path d={chart.area} className="fill-menta" opacity="0.55" />
        <path
          d={chart.line}
          fill="none"
          className="stroke-pinheiro"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chart.dots.map((d) => (
          <circle
            key={d.point.id}
            cx={d.x}
            cy={d.y}
            r="5"
            className="fill-branco stroke-pinheiro"
            strokeWidth="3"
          />
        ))}
        <text
          x="14"
          y={H - 8}
          className="fill-tinta-suave text-[11px] font-semibold"
        >
          {formatISODate(first.on)}
        </text>
        {points.length > 1 ? (
          <text
            x={W - 14}
            y={H - 8}
            textAnchor="end"
            className="fill-tinta-suave text-[11px] font-semibold"
          >
            {formatISODate(last.on)}
          </text>
        ) : null}
      </svg>
    </figure>
  );
}

/** Mini-gráfico do resumo: só a linha. */
export function Sparkline({ points }: { points: WeightPoint[] }) {
  const W = 120;
  const H = 44;
  const chart = buildChart(points, W, H, {
    top: 6,
    right: 6,
    bottom: 6,
    left: 6,
  });
  if (!chart || points.length < 2) return null;
  const end = chart.dots[chart.dots.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="h-11 w-[120px]">
      <path
        d={chart.line}
        fill="none"
        className="stroke-pinheiro"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={end.x} cy={end.y} r="4" className="fill-pinheiro" />
    </svg>
  );
}
