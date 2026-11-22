import { RRule } from "rrule";

import { addDaysISO } from "./next-due";

export type Frequency = "daily1" | "daily2" | "every" | "other";
export type Duration = "days" | "until" | "ongoing";

export type MedicationDraft = {
  frequency: Frequency;
  /** «De X em X dias». */
  everyDays: number;
  /** HH:mm (a 2.ª toma de «2× por dia» é a segunda hora). */
  time: string;
  time2: string;
  duration: Duration;
  days: number;
  until: string;
  startsOn: string;
};

function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

/** RRULE da frequência escolhida; `null` para «Outra» (fica descrita nas notas). */
export function buildRRule(d: MedicationDraft): string | null {
  if (d.frequency === "other") return null;
  const t1 = parseTime(d.time);
  if (!t1) return null;
  const hours = [t1.hour];
  if (d.frequency === "daily2") {
    const t2 = parseTime(d.time2);
    if (!t2) return null;
    hours.push(t2.hour);
  }
  const rule = new RRule({
    freq: RRule.DAILY,
    interval: d.frequency === "every" ? Math.max(1, d.everyDays) : 1,
    byhour: [...new Set(hours)].sort((a, b) => a - b),
    byminute: [t1.minute],
    bysecond: [0],
  });
  return rule.toString().replace(/^RRULE:/, "");
}

/** Última toma: início + (dias − 1); «até data»; ou sem fim. */
export function endsOn(d: MedicationDraft): string | null {
  if (d.duration === "ongoing") return null;
  if (d.duration === "until") return d.until || null;
  return d.days >= 1 ? addDaysISO(d.startsOn, d.days - 1) : null;
}

/** Descrição curta em PT-PT a partir de uma RRULE (a que o app cria). */
export function describeRRule(rrule: string | null | undefined): string {
  if (!rrule) return "";
  try {
    const o = RRule.fromString(rrule).options;
    const hours = o.byhour ?? [];
    const times = hours
      .map(
        (h) =>
          `${String(h).padStart(2, "0")}:${String((o.byminute ?? [0])[0] ?? 0).padStart(2, "0")}`,
      )
      .join(" e ");
    const freq =
      o.interval > 1
        ? `De ${o.interval} em ${o.interval} dias`
        : hours.length === 2
          ? "2× por dia"
          : "1× por dia";
    return times ? `${freq} · ${times}` : freq;
  } catch {
    return "";
  }
}
