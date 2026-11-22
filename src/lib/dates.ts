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
