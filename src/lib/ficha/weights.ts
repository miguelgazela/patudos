import { addMonthsISO } from "@/lib/vet-visits/next-due";
import { formatKg } from "@/lib/units";

import { daysBetween } from "./due";

export type WeightPoint = { id: string; on: string; kg: number };

export const RANGES = ["6m", "1a", "tudo"] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_LABEL: Record<Range, string> = {
  "6m": "6 meses",
  "1a": "1 ano",
  tudo: "Tudo",
};

export function parseRange(value: string | string[] | undefined): Range {
  return RANGES.find((r) => r === value) ?? "tudo";
}

/** Pesagens dentro do período, por ordem de data crescente. */
export function filterRange(
  points: WeightPoint[],
  range: Range,
  today: string,
): WeightPoint[] {
  const sorted = [...points].sort((a, b) => a.on.localeCompare(b.on));
  if (range === "tudo") return sorted;
  const from = addMonthsISO(today, range === "6m" ? -6 : -12);
  return sorted.filter((p) => p.on >= from);
}

/** Diferença entre a última pesagem e a anterior (`points` por ordem crescente). */
export function weightVariation(
  points: WeightPoint[],
): { deltaKg: number; since: string } | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  return {
    deltaKg: Math.round((last.kg - prev.kg) * 100) / 100,
    since: prev.on,
  };
}

/** «+0,4 kg», «−0,2 kg» (sinal menos de verdade) ou «Sem alteração». */
export function formatDelta(deltaKg: number): string {
  if (deltaKg === 0) return "Sem alteração";
  const sign = deltaKg > 0 ? "+" : "−";
  return `${sign}${formatKg(Math.abs(deltaKg))}`;
}

export type Chart = {
  line: string;
  area: string;
  dots: { x: number; y: number; point: WeightPoint }[];
  minKg: number;
  maxKg: number;
};

/**
 * Geometria do gráfico de linha em SVG: X proporcional à data, Y entre o mínimo e o máximo
 * (com folga), para variações pequenas continuarem visíveis.
 */
export function buildChart(
  points: WeightPoint[],
  width: number,
  height: number,
  pad = { top: 12, right: 12, bottom: 12, left: 12 },
): Chart | null {
  if (!points.length) return null;
  const kgs = points.map((p) => p.kg);
  let minKg = Math.min(...kgs);
  let maxKg = Math.max(...kgs);
  if (minKg === maxKg) {
    minKg -= 0.5;
    maxKg += 0.5;
  } else {
    const margin = (maxKg - minKg) * 0.15;
    minKg -= margin;
    maxKg += margin;
  }
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const first = points[0]!.on;
  const span = daysBetween(first, points[points.length - 1]!.on);

  const dots = points.map((point) => {
    const x =
      span === 0
        ? pad.left + innerW / 2
        : pad.left + (daysBetween(first, point.on) / span) * innerW;
    const y = pad.top + (1 - (point.kg - minKg) / (maxKg - minKg)) * innerH;
    return { x: round(x), y: round(y), point };
  });
  const line = dots
    .map((d, i) => `${i === 0 ? "M" : "L"}${d.x} ${d.y}`)
    .join(" ");
  const baseY = pad.top + innerH;
  const area = `${line} L${dots[dots.length - 1]!.x} ${baseY} L${dots[0]!.x} ${baseY} Z`;
  return { line, area, dots, minKg, maxKg };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
