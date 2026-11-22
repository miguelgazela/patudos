const TZ = "Europe/Lisbon";

/** «Sábado, 21 de novembro», em Europe/Lisbon. */
export function longDate(date: Date): string {
  const text = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Saudação conforme a hora em Europe/Lisbon. */
export function greeting(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: TZ,
    }).format(date),
  );
  if (hour >= 5 && hour < 13) return "Bom dia";
  if (hour >= 13 && hour < 20) return "Boa tarde";
  return "Boa noite";
}

/** Hoje em `Europe/Lisbon`, como `yyyy-MM-dd`. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `2026-11-21` → `21/11/2026` (sem converter fusos: já é uma data de calendário). */
export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function partsIn(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
}

/** Dia em Europe/Lisbon de um instante, como `yyyy-MM-dd`. */
export function lisbonDate(date: Date | string): string {
  const p = partsIn(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hora em Europe/Lisbon de um instante, como `HH:mm`. */
export function lisbonTime(date: Date | string): string {
  const p = partsIn(date);
  return `${p.hour}:${p.minute}`;
}

/** Data relativa em PT-PT: «há 2 dias», «ontem», «hoje», «amanhã», «daqui a 12 dias». */
export function relativeDay(iso: string, today: string): string {
  const d = Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  return d < 0 ? `há ${-d} dias` : `daqui a ${d} dias`;
}
