/**
 * Conversões de entrada e apresentação em PT-PT: euros ↔ cêntimos, kg com vírgula.
 * Aceitam vírgula ou ponto como separador decimal.
 */

function normalize(input: string): string {
  return input
    .replace(/[\s  €]/g, "")
    .replace(/kg$/i, "")
    .replace(",", ".");
}

/** «45», «45,5», «45,50 €» → cêntimos; `null` se não for um valor válido (≥ 0, até 2 casas). */
export function parseEuroToCents(input: string): number | null {
  const s = normalize(input);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** 4500 → `45,00 €` (com `1 234,56 €` a partir dos milhares). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always", // pt-PT só agrupa a partir de 5 dígitos; queremos 1 234,56 €
  })
    .format(cents / 100)
    .replace(/ /g, " ");
}

/** «12,4», «12.40», «12,4 kg» → 12.4; `null` se inválido (> 0, até 2 casas). */
export function parseKg(input: string): number | null {
  const s = normalize(input);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** 12.4 → `12,4 kg`. */
export function formatKg(kg: number): string {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(kg)} kg`;
}
