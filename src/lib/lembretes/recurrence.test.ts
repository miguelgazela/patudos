import { describe, expect, it } from "vitest";

import { buildRRule, describeRecurrence, parseRepeat } from "./recurrence";

describe("buildRRule", () => {
  it("gera a regra de cada opção", () => {
    expect(buildRRule({ kind: "never", every: 2 })).toBeNull();
    expect(buildRRule({ kind: "daily", every: 2 })).toBe("FREQ=DAILY");
    expect(buildRRule({ kind: "weekly", every: 2 })).toBe("FREQ=WEEKLY");
    expect(buildRRule({ kind: "monthly", every: 2 })).toBe("FREQ=MONTHLY");
    expect(buildRRule({ kind: "everyMonths", every: 3 })).toBe(
      "FREQ=MONTHLY;INTERVAL=3",
    );
    expect(buildRRule({ kind: "yearly", every: 2 })).toBe("FREQ=YEARLY");
  });
  it("«De X em X meses» nunca fica abaixo de 2", () => {
    expect(buildRRule({ kind: "everyMonths", every: 0 })).toBe(
      "FREQ=MONTHLY;INTERVAL=2",
    );
  });
});

describe("parseRepeat", () => {
  it("é o inverso de buildRRule", () => {
    for (const r of [
      { kind: "daily", every: 2 },
      { kind: "weekly", every: 2 },
      { kind: "monthly", every: 2 },
      { kind: "everyMonths", every: 6 },
      { kind: "yearly", every: 2 },
    ] as const) {
      expect(parseRepeat(buildRRule(r))).toEqual(r);
    }
    expect(parseRepeat(null).kind).toBe("never");
  });
});

describe("describeRecurrence", () => {
  it("descreve em PT-PT", () => {
    expect(describeRecurrence(null)).toBe("");
    expect(describeRecurrence("FREQ=DAILY")).toBe("Todos os dias");
    expect(describeRecurrence("FREQ=MONTHLY")).toBe("Todos os meses");
    expect(describeRecurrence("FREQ=MONTHLY;INTERVAL=3")).toBe(
      "De 3 em 3 meses",
    );
    expect(describeRecurrence("FREQ=YEARLY")).toBe("Todos os anos");
    expect(describeRecurrence("FREQ=WEEKLY;INTERVAL=2")).toBe(
      "De 2 em 2 semanas",
    );
  });
  it("usa a descrição da medicação quando há horas", () => {
    expect(
      describeRecurrence("FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0"),
    ).toBe("1× por dia · 08:00");
  });
});
