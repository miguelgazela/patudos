export type DueEvent = {
  id: string;
  type: string;
  title: string;
  occurred_on: string;
  next_due_on: string | null;
};

export type DueStatus = "overdue" | "today" | "soon" | "later";

/** Dias de calendário entre duas datas «yyyy-mm-dd» (positivo se `toIso` é depois). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Em atraso, hoje, em breve (≤ 14 dias) ou mais tarde. */
export function dueStatus(
  due: string,
  today: string,
  soonDays = 14,
): DueStatus {
  const d = daysBetween(today, due);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return d <= soonDays ? "soon" : "later";
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/** «Em atraso há 3 dias», «Hoje», «Amanhã», «Em 12 dias», «Em 5 meses». */
export function dueLabel(due: string, today: string): string {
  const d = daysBetween(today, due);
  if (d < 0) return `Em atraso há ${plural(-d, "dia", "dias")}`;
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d <= 60) return `Em ${d} dias`;
  const months = Math.round(d / 30.4);
  return `Em ${plural(months, "mês", "meses")}`;
}

export type UpcomingDate = DueEvent & {
  next_due_on: string;
  status: DueStatus;
};

/**
 * Próximas datas: por cada tratamento (tipo + título) só conta o registo mais recente,
 * porque uma dose nova substitui a data prevista da anterior. Ordem: da mais urgente à mais distante.
 * `events` deve vir do mais recente para o mais antigo.
 */
export function upcomingDates(
  events: DueEvent[],
  today: string,
): UpcomingDate[] {
  const latest = new Map<string, DueEvent>();
  for (const e of events) {
    const key = `${e.type}|${e.title.trim().toLowerCase()}`;
    const current = latest.get(key);
    if (!current || e.occurred_on > current.occurred_on) latest.set(key, e);
  }
  return [...latest.values()]
    .filter((e): e is DueEvent & { next_due_on: string } => !!e.next_due_on)
    .map((e) => ({ ...e, status: dueStatus(e.next_due_on, today) }))
    .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on));
}
