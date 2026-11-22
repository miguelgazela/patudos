/** Soma meses a uma data ISO (yyyy-MM-dd), sem passar do fim do mês: 31/01 + 1 mês = 28/02. */
export function addMonthsISO(iso: string, months: number): string {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/** Próxima data sugerida a partir do intervalo do preset (`care_presets.interval_months`). */
export function suggestNextDue(
  occurredOn: string,
  intervalMonths: number,
): string {
  return addMonthsISO(occurredOn, intervalMonths);
}

/** Soma dias a uma data ISO (yyyy-MM-dd). */
export function addDaysISO(iso: string, days: number): string {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
