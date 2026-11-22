import { parseEuroToCents, parseKg } from "@/lib/units";

import type { TreatmentItem } from "./draft";
import { effectiveNextDue } from "./payload";
import {
  homeTreatmentSchema,
  quickWeightSchema,
  type HomeTreatmentPayload,
} from "./schema";

export type QuickBuild<T> = {
  payload: T | null;
  errors: Record<string, string>;
};

function collect(
  issues: { path: PropertyKey[]; message: string }[],
  errors: Record<string, string>,
) {
  for (const i of issues) errors[i.path.join(".") || "form"] ??= i.message;
}

/** Peso fora de consulta: valida kg (vírgula PT) e data. */
export function buildWeightPayload(input: {
  petId: string;
  date: string;
  kg: string;
}): QuickBuild<ReturnType<typeof quickWeightSchema.parse>> {
  const errors: Record<string, string> = {};
  const kg = parseKg(input.kg);
  if (kg === null) errors.weight_kg = "Escreve o peso, por exemplo 12,4.";
  const parsed = quickWeightSchema.safeParse({
    pet_id: input.petId,
    measured_on: input.date || undefined,
    weight_kg: kg ?? undefined,
  });
  if (!parsed.success) {
    collect(parsed.error.issues, errors);
    return { payload: null, errors };
  }
  return Object.keys(errors).length
    ? { payload: null, errors }
    : { payload: parsed.data, errors };
}

/** Tratamento em casa: do item do painel 14 + data + custo para o payload de `record_home_treatment`. */
export function buildTreatmentPayload(input: {
  petId: string;
  date: string;
  item: TreatmentItem;
  cost: string;
}): QuickBuild<HomeTreatmentPayload> {
  const errors: Record<string, string> = {};
  const { item } = input;

  let expense: { amount_cents: number } | undefined;
  if (input.cost.trim() !== "") {
    const cents = parseEuroToCents(input.cost);
    if (cents === null) {
      errors["expense.amount_cents"] = "Escreve o valor, por exemplo 45,00.";
    } else if (cents > 0) {
      expense = { amount_cents: cents };
    }
  }

  const parsed = homeTreatmentSchema.safeParse({
    pet_id: input.petId,
    // «Outra…» na aba das desparasitações não tem tipo próprio: fica como interna.
    type: item.type === "other" ? "deworming_internal" : item.type,
    title: item.title,
    occurred_on: input.date || undefined,
    product: item.product || undefined,
    preset_id: item.presetId ?? undefined,
    next_due_on: effectiveNextDue(item, input.date) || undefined,
    remind: item.remind,
    expense,
  });
  if (!parsed.success) {
    collect(parsed.error.issues, errors);
    return { payload: null, errors };
  }
  return Object.keys(errors).length
    ? { payload: null, errors }
    : { payload: parsed.data, errors };
}
