/**
 * Tributos: datas que podem ser aproximadas («12/09/2026», «setembro de 2026», «2026»),
 * validação e texto. Puro: serve o servidor e o cliente.
 */

export const PRECISIONS = ["day", "month", "year"] as const;
export type Precision = (typeof PRECISIONS)[number];

export const TRIBUTE_TEXT_MAX = 1500;
export const MEMORY_MAX = 600;

export function isPrecision(v: string): v is Precision {
  return (PRECISIONS as readonly string[]).includes(v);
}

/** Comprimento do prefixo «yyyy-mm-dd» que interessa a cada precisão. */
const PREFIX: Record<Precision, number> = { day: 10, month: 7, year: 4 };

/** Ajusta um valor «yyyy-mm-dd» / «yyyy-mm» / «yyyy» a outra precisão (corta; não inventa). */
export function convertPartial(value: string, to: Precision): string {
  const len = PREFIX[to];
  return value.length >= len ? value.slice(0, len) : "";
}

export type PartialDate =
  | { ok: true; date: string; precision: Precision }
  | { ok: false; message: string };

const INVALID = "Escolhe uma data válida.";
const FUTURE = "A data não pode ser no futuro.";

function validDay(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Lê uma data com precisão. Devolve sempre o primeiro dia do período («2026-09-01» para
 * setembro de 2026; «2026-01-01» para 2026), que é o que se guarda na coluna `date`.
 */
export function parsePartialDate(
  value: string,
  precision: string,
  today: string,
): PartialDate {
  const v = value.trim();
  if (!isPrecision(precision)) return { ok: false, message: INVALID };

  let date: string;
  if (precision === "day") {
    if (!validDay(v)) return { ok: false, message: INVALID };
    date = v;
  } else if (precision === "month") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))
      return { ok: false, message: INVALID };
    date = `${v}-01`;
  } else {
    if (!/^\d{4}$/.test(v)) return { ok: false, message: INVALID };
    date = `${v}-01-01`;
  }

  if (Number(date.slice(0, 4)) < 1980) return { ok: false, message: INVALID };
  if (date.slice(0, PREFIX[precision]) > today.slice(0, PREFIX[precision])) {
    return { ok: false, message: FUTURE };
  }
  return { ok: true, date, precision };
}

/** O falecimento não pode ser antes do nascimento (comparado com a precisão do falecimento). */
export function isBeforeBirth(
  birthDate: string,
  deceasedOn: string,
  precision: Precision,
): boolean {
  const len = PREFIX[precision];
  return deceasedOn.slice(0, len) < birthDate.slice(0, len);
}

const MONTH_YEAR = new Intl.DateTimeFormat("pt-PT", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «12/09/2026», «setembro de 2026» ou «2026». */
export function formatPartialDate(date: string, precision: Precision): string {
  const [y = "", m = "", d = ""] = date.split("-");
  if (precision === "year") return y;
  if (precision === "month") {
    return MONTH_YEAR.format(new Date(Date.UTC(Number(y), Number(m) - 1, 1)));
  }
  return `${d}/${m}/${y}`;
}

/** «2012 – 2026»; sem nascimento, só o ano do falecimento. */
export function lifeSpan(birthDate: string | null, deceasedOn: string): string {
  const died = deceasedOn.slice(0, 4);
  return birthDate ? `${birthDate.slice(0, 4)} – ${died}` : died;
}

/** Texto opcional com limite; vazio vira `null`. */
export function parseOptionalText(
  raw: string | undefined,
  max: number,
  message: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const v = (raw ?? "").trim();
  if (v.length > max) return { ok: false, message };
  return { ok: true, value: v === "" ? null : v };
}
