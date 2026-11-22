import { daysBetween } from "@/lib/ficha/due";
import { lisbonDate, lisbonTime, relativeDay } from "@/lib/dates";
import { addDaysISO } from "@/lib/vet-visits/next-due";

export type OccurrenceRow = {
  id: string;
  reminderId: string;
  petId: string;
  title: string;
  scheduledFor: string;
  rrule: string | null;
  sourceType: "health_event" | "medication" | null;
  sourceId: string | null;
  /** Lembrete ativo e não terminado. */
  live: boolean;
  doneAt: string | null;
  doneBy: string | null;
};

export type ItemKind = "treatment" | "medication" | "manual";

export type HojeEntry = OccurrenceRow & {
  kind: ItemKind;
  /** `yyyy-MM-dd` em Lisboa. */
  date: string;
  time: string;
};

export type HojeGroups = {
  overdue: HojeEntry[];
  today: HojeEntry[];
  upcoming: HojeEntry[];
  recentlyDone: HojeEntry[];
};

/** Tomas recorrentes em atraso há mais disto deixam de aparecer (não acumula «em atraso» para sempre). */
export const RECURRING_OVERDUE_DAYS = 2;
export const RECENTLY_DONE_HOURS = 2;
export const UPCOMING_DAYS = 30;

function kindOf(r: OccurrenceRow): ItemKind {
  return r.sourceType === "health_event"
    ? "treatment"
    : r.sourceType === "medication"
      ? "medication"
      : "manual";
}

/**
 * Reparte as ocorrências do Hoje: em atraso · hoje · próximos 30 dias · feitas há pouco.
 * Nos próximos dias, um lembrete recorrente só mostra a ocorrência seguinte.
 */
export function groupHoje(
  rows: OccurrenceRow[],
  now: Date = new Date(),
): HojeGroups {
  const today = lisbonDate(now);
  const limit = addDaysISO(today, UPCOMING_DAYS);
  const doneSince = now.getTime() - RECENTLY_DONE_HOURS * 3_600_000;
  const out: HojeGroups = {
    overdue: [],
    today: [],
    upcoming: [],
    recentlyDone: [],
  };
  const seen = new Set<string>();

  const sorted = [...rows].sort((a, b) =>
    a.scheduledFor.localeCompare(b.scheduledFor),
  );
  for (const r of sorted) {
    const entry: HojeEntry = {
      ...r,
      kind: kindOf(r),
      date: lisbonDate(r.scheduledFor),
      time: lisbonTime(r.scheduledFor),
    };
    if (r.doneAt) {
      if (new Date(r.doneAt).getTime() >= doneSince)
        out.recentlyDone.push(entry);
      continue;
    }
    if (!r.live) continue;
    const diff = daysBetween(today, entry.date);
    if (diff < 0) {
      if (r.rrule && -diff > RECURRING_OVERDUE_DAYS) continue;
      out.overdue.push(entry);
    } else if (diff === 0) {
      out.today.push(entry);
    } else if (entry.date <= limit) {
      if (r.rrule) {
        if (seen.has(r.reminderId)) continue;
        seen.add(r.reminderId);
      }
      out.upcoming.push(entry);
    }
  }
  out.recentlyDone.sort((a, b) =>
    (b.doneAt ?? "").localeCompare(a.doneAt ?? ""),
  );
  return out;
}

/** «há 2 dias · 19/11», «Hoje às 20:00», «amanhã · 22/11». */
export function whenLabel(e: HojeEntry, today: string): string {
  const [, m, d] = e.date.split("-");
  const at = e.kind === "treatment" ? "" : ` às ${e.time}`;
  if (e.date === today) return `Hoje${at}`;
  return `${relativeDay(e.date, today)} · ${d}/${m}${e.kind === "treatment" ? "" : ` às ${e.time}`}`;
}

/** «agora», «há 5 min», «há 2 h» (sempre relativo ao `nowMs` recebido, para não variar na hidratação). */
export function agoLabel(doneAt: string, nowMs: number): string {
  const min = Math.max(
    0,
    Math.round((nowMs - new Date(doneAt).getTime()) / 60_000),
  );
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.round(min / 60)} h`;
}
