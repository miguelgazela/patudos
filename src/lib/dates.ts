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
