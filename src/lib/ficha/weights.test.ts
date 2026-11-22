import { describe, expect, it } from "vitest";

import {
  buildChart,
  filterRange,
  formatDelta,
  parseRange,
  weightVariation,
} from "./weights";

const pts = [
  { id: "a", on: "2025-09-01", kg: 11 },
  { id: "b", on: "2026-03-01", kg: 12 },
  { id: "c", on: "2026-09-20", kg: 12.4 },
  { id: "d", on: "2026-11-10", kg: 12.2 },
];

describe("peso", () => {
  it("filtra por período e ordena por data", () => {
    const today = "2026-11-22";
    expect(filterRange([...pts].reverse(), "tudo", today)).toHaveLength(4);
    expect(filterRange(pts, "1a", today).map((p) => p.id)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(filterRange(pts, "6m", today).map((p) => p.id)).toEqual(["c", "d"]);
    expect(parseRange("6m")).toBe("6m");
    expect(parseRange("xpto")).toBe("tudo");
  });

  it("variação face à pesagem anterior", () => {
    expect(weightVariation(pts)).toEqual({
      deltaKg: -0.2,
      since: "2026-09-20",
    });
    expect(weightVariation(pts.slice(0, 1))).toBeNull();
    expect(formatDelta(0.4)).toBe("+0,4 kg");
    expect(formatDelta(-0.2)).toBe("−0,2 kg");
    expect(formatDelta(0)).toBe("Sem alteração");
  });

  it("geometria do gráfico: x pela data, y invertido", () => {
    const c = buildChart(pts, 200, 100, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })!;
    expect(c.dots[0]!.x).toBe(0);
    expect(c.dots[3]!.x).toBe(200);
    // o mais pesado fica mais acima (y menor)
    const top = c.dots.reduce((m, d) => (d.y < m.y ? d : m));
    expect(top.point.id).toBe("c");
    expect(buildChart([], 200, 100)).toBeNull();
    // um só ponto: centrado
    expect(
      buildChart(pts.slice(0, 1), 200, 100, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      })!.dots[0]!.x,
    ).toBe(100);
  });
});
