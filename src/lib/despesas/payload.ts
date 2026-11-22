import { formatCents, parseEuroToCents } from "@/lib/units";
import type { ExpenseCategory } from "@/lib/vet-visits/schema";

import { splitEqually, sumParts } from "./split";

export type ExpenseDraft = {
  /** Em edição. */
  id?: string;
  /** Texto do campo do valor («25,01»). */
  amount: string;
  category: ExpenseCategory | null;
  petIds: string[];
  /** Valores ajustados à mão (texto por animal); `null` = partes iguais. */
  custom: Record<string, string> | null;
  date: string;
  paidBy: string | null;
  description: string;
  documentId: string | null;
  /**
   * Edição de uma despesa com partes de animais que o utilizador não vê:
   * o total e os animais não se alteram (só os restantes campos).
   */
  lockedAmountCents?: number;
};

export type ExpensePayload = {
  id?: string;
  amount_cents: number;
  category: ExpenseCategory;
  spent_on: string;
  description?: string;
  paid_by?: string;
  document_id?: string;
  splits?: { pet_id: string; amount_cents: number }[];
};

/** Valores por animal que o ecrã mostra (iguais, ou os ajustados). `null` se o texto não for válido. */
export function draftParts(
  d: Pick<ExpenseDraft, "amount" | "petIds" | "custom">,
): { petId: string; cents: number | null }[] {
  if (d.custom) {
    return d.petIds.map((petId) => ({
      petId,
      cents: parseEuroToCents(d.custom?.[petId] ?? "0"),
    }));
  }
  const total = parseEuroToCents(d.amount) ?? 0;
  return splitEqually(total, d.petIds);
}

export function buildExpensePayload(
  d: ExpenseDraft,
  today: string,
): { payload: ExpensePayload | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const locked = d.lockedAmountCents !== undefined;
  const cents = locked ? d.lockedAmountCents! : parseEuroToCents(d.amount);
  if (cents === null || cents <= 0) {
    errors.amount = "Escreve o valor, por exemplo 25,50.";
  }
  if (!d.category) errors.category = "Escolhe a categoria.";
  if (!locked && d.petIds.length === 0) {
    errors.pets = "Escolhe pelo menos um animal.";
  }

  let splits: ExpensePayload["splits"];
  if (!locked && cents && cents > 0 && d.petIds.length > 0) {
    const parts = draftParts(d);
    let invalid = false;
    for (const p of parts) {
      if (p.cents === null) {
        errors[`split.${p.petId}`] = "Escreve o valor, por exemplo 12,50.";
        invalid = true;
      }
    }
    if (!invalid) {
      const clean = parts.map((p) => ({ petId: p.petId, cents: p.cents ?? 0 }));
      const diff = cents - sumParts(clean);
      if (diff !== 0) {
        errors.splits = `A soma das partes (${formatCents(sumParts(clean))}) não é igual ao total (${formatCents(cents)}). ${diff > 0 ? "Faltam" : "Sobram"} ${formatCents(Math.abs(diff))}.`;
      } else {
        splits = clean.map((p) => ({
          pet_id: p.petId,
          amount_cents: p.cents,
        }));
      }
    }
  }

  if (Object.keys(errors).length || !d.category || !cents) {
    return { payload: null, errors };
  }

  const description = d.description.trim();
  return {
    payload: {
      ...(d.id ? { id: d.id } : {}),
      amount_cents: cents,
      category: d.category,
      spent_on: d.date || today,
      ...(description ? { description } : {}),
      ...(d.paidBy ? { paid_by: d.paidBy } : {}),
      ...(d.documentId ? { document_id: d.documentId } : {}),
      ...(splits ? { splits } : {}),
    },
    errors,
  };
}
