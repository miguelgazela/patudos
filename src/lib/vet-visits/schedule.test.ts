import { RRule } from "rrule";
import { describe, expect, it } from "vitest";

import { addDaysISO } from "./next-due";
import {
  buildRRule,
  describeRRule,
  endsOn,
  type MedicationDraft,
} from "./schedule";

const base: MedicationDraft = {
  frequency: "daily1",
  everyDays: 2,
  time: "08:00",
  time2: "20:00",
  duration: "days",
  days: 7,
  until: "",
  startsOn: "2026-11-21",
};

describe("RRULE da medicação", () => {
  it("1× por dia", () => {
    const r = buildRRule(base)!;
    expect(r).toBe("FREQ=DAILY;INTERVAL=1;BYHOUR=8;BYMINUTE=0;BYSECOND=0");
    expect(RRule.fromString(r).options.freq).toBe(RRule.DAILY);
  });
  it("2× por dia, ordenado", () => {
    expect(
      buildRRule({
        ...base,
        frequency: "daily2",
        time: "20:30",
        time2: "08:30",
      }),
    ).toBe("FREQ=DAILY;INTERVAL=1;BYHOUR=8,20;BYMINUTE=30;BYSECOND=0");
  });
  it("de X em X dias", () => {
    const r = buildRRule({ ...base, frequency: "every", everyDays: 3 })!;
    expect(r).toContain("INTERVAL=3");
    expect(RRule.fromString(r).options.interval).toBe(3);
  });
  it("«Outra» e horas inválidas não geram regra", () => {
    expect(buildRRule({ ...base, frequency: "other" })).toBeNull();
    expect(buildRRule({ ...base, time: "" })).toBeNull();
  });
  it("descreve em português", () => {
    expect(describeRRule(buildRRule(base))).toBe("1× por dia · 08:00");
    expect(describeRRule(buildRRule({ ...base, frequency: "daily2" }))).toBe(
      "2× por dia · 08:00 e 20:00",
    );
    expect(
      describeRRule(buildRRule({ ...base, frequency: "every", everyDays: 2 })),
    ).toBe("De 2 em 2 dias · 08:00");
    expect(describeRRule("lixo")).toBe("");
  });
});

describe("duração", () => {
  it("X dias conta o próprio dia de início", () => {
    expect(endsOn(base)).toBe("2026-11-27");
    expect(endsOn({ ...base, days: 1 })).toBe("2026-11-21");
  });
  it("até data e contínua", () => {
    expect(endsOn({ ...base, duration: "until", until: "2026-12-01" })).toBe(
      "2026-12-01",
    );
    expect(endsOn({ ...base, duration: "ongoing" })).toBeNull();
  });
  it("soma dias entre meses", () => {
    expect(addDaysISO("2026-11-28", 5)).toBe("2026-12-03");
  });
});
