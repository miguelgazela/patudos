export type DayGroup<T> = { date: string; label: string; items: T[] };

/** «Sábado, 21/11», a partir de uma data de calendário (sem fusos). */
export function dayLabel(iso: string): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** Agrupa por dia, mantendo a ordem recebida (os mais recentes primeiro). */
export function groupByDay<T extends { spentOn: string }>(
  items: T[],
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.spentOn) last.items.push(item);
    else
      groups.push({
        date: item.spentOn,
        label: dayLabel(item.spentOn),
        items: [item],
      });
  }
  return groups;
}
