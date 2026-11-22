const TZ = "Europe/Lisbon";

/** «2026-11-22» em Europe/Lisbon. */
export function lisbonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(now);
}

function parts(iso: string) {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return { y, m, d };
}

/** Meses completos entre duas datas «yyyy-mm-dd». */
export function monthsBetween(fromIso: string, toIso: string): number {
  const a = parts(fromIso);
  const b = parts(toIso);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return Math.max(0, months);
}

/** «3 anos», «1 ano», «8 meses», «1 mês», «Recém-nascido». */
export function formatAge(birthDate: string, now: Date = new Date()): string {
  const months = monthsBetween(birthDate, lisbonToday(now));
  if (months < 1) return "Menos de 1 mês";
  if (months < 12) return months === 1 ? "1 mês" : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano" : `${years} anos`;
}

/** Data de nascimento aproximada: hoje menos N meses/anos («yyyy-mm-dd»). */
export function approxBirthDate(
  value: number,
  unit: "months" | "years",
  now: Date = new Date(),
): string {
  const { y, m, d } = parts(lisbonToday(now));
  const totalMonths = unit === "years" ? value * 12 : value;
  const idx = y * 12 + (m - 1) - totalMonths;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/** Para repor o campo «idade aproximada» ao editar. */
export function approxFromBirthDate(
  birthDate: string,
  now: Date = new Date(),
): { value: number; unit: "months" | "years" } {
  const months = monthsBetween(birthDate, lisbonToday(now));
  return months < 24
    ? { value: months, unit: "months" }
    : { value: Math.round(months / 12), unit: "years" };
}

/** «11/2025» */
export function monthYear(iso: string): string {
  const { y, m } = parts(iso);
  return `${String(m).padStart(2, "0")}/${y}`;
}

/** «12/03/2024» */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}
