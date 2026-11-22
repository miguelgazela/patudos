export type PeriodKind = "month" | "year";

export type Period = {
  kind: PeriodKind;
  /** `2026-11` (mês) ou `2026` (ano): o que vai no URL. */
  key: string;
  /** Primeiro dia (inclusivo), `yyyy-MM-dd`. */
  from: string;
  /** Primeiro dia a seguir ao período (exclusivo). */
  to: string;
  /** «Novembro 2026» ou «Ano 2026». */
  label: string;
};

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");

function build(kind: PeriodKind, y: number, m: number): Period {
  if (kind === "year") {
    return {
      kind,
      key: String(y),
      from: `${y}-01-01`,
      to: `${y + 1}-01-01`,
      label: `Ano ${y}`,
    };
  }
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return {
    kind,
    key: `${y}-${pad(m)}`,
    from: `${y}-${pad(m)}-01`,
    to: `${ny}-${pad(nm)}-01`,
    label: `${MONTHS[m - 1]} ${y}`,
  };
}

/** `?p=2026-11` → mês; `?p=2026` → ano; qualquer outra coisa → o mês de `today`. */
export function parsePeriod(
  value: string | string[] | undefined,
  today: string,
): Period {
  const v = Array.isArray(value) ? value[0] : value;
  const month = v ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(v) : null;
  if (month) return build("month", Number(month[1]), Number(month[2]));
  const year = v ? /^(\d{4})$/.exec(v) : null;
  if (year) return build("year", Number(year[1]), 1);
  const [y = 1970, m = 1] = today.split("-").map(Number);
  return build("month", y, m);
}

/** Período anterior (−1) ou seguinte (+1) do mesmo tipo. */
export function shiftPeriod(period: Period, delta: -1 | 1): Period {
  const [y = 1970, m = 1] = period.key.split("-").map(Number);
  if (period.kind === "year") return build("year", y + delta, 1);
  const idx = y * 12 + (m - 1) + delta;
  return build("month", Math.floor(idx / 12), (idx % 12) + 1);
}

/** Não se navega para o futuro. */
export function hasNext(period: Period, today: string): boolean {
  return shiftPeriod(period, 1).from <= today;
}

/** O período que contém `today`? */
export function isCurrent(period: Period, today: string): boolean {
  return today >= period.from && today < period.to;
}

/** Muda de mês para ano (e vice-versa) mantendo o ano; de ano para mês escolhe o mês atual ou dezembro. */
export function switchKind(
  period: Period,
  kind: PeriodKind,
  today: string,
): Period {
  if (period.kind === kind) return period;
  const [y = 1970] = period.key.split("-").map(Number);
  if (kind === "year") return build("year", y, 1);
  const [ty = y, tm = 1] = today.split("-").map(Number);
  return build("month", y, y === ty ? tm : 12);
}

/** Mês em minúsculas para frases: «novembro». */
export function monthName(period: Period): string {
  const m = Number(period.key.split("-")[1] ?? 1);
  return (MONTHS[m - 1] ?? "").toLowerCase();
}
