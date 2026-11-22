export type SplitPart = { petId: string; cents: number };

/**
 * Divide `totalCents` em partes iguais pelos animais, pela ordem recebida.
 * Os cêntimos que sobram vão todos para o primeiro animal (determinístico):
 * 25,01 € por 2 → 12,51 € + 12,50 €.
 */
export function splitEqually(
  totalCents: number,
  petIds: string[],
): SplitPart[] {
  const n = petIds.length;
  if (n === 0) return [];
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return petIds.map((petId, i) => ({
    petId,
    cents: i === 0 ? base + rest : base,
  }));
}

export function sumParts(parts: { cents: number }[]): number {
  return parts.reduce((sum, p) => sum + p.cents, 0);
}

/** 2501 → `25,01` (para preencher o campo do valor). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
