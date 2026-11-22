import { parseEuroToCents, parseKg } from "@/lib/units";

import type { TreatmentItem, VisitDraft } from "./draft";
import { suggestNextDue } from "./next-due";
import { buildRRule, endsOn } from "./schedule";
import { vetVisitSchema, type VetVisitInput } from "./schema";

/** A próxima data de um tratamento: a editada à mão, ou a sugerida a partir da data da consulta. */
export function effectiveNextDue(
  item: TreatmentItem,
  visitDate: string,
): string {
  if (item.nextDueManual) return item.nextDue;
  return item.intervalMonths
    ? suggestNextDue(visitDate, item.intervalMonths)
    : item.nextDue;
}

export type BuildResult = {
  payload: VetVisitInput;
  /** Chave do campo (como em `reason`, `weight_kg`, `expense.amount_cents`, `health_events.0.title`) → mensagem. */
  errors: Record<string, string>;
};

/** Do rascunho do ecrã para o payload de `record_vet_visit`, já validado com o mesmo Zod do servidor. */
export function buildPayload(d: VisitDraft): BuildResult {
  const errors: Record<string, string> = {};

  const health_events: NonNullable<VetVisitInput["health_events"]> = [];
  const medications: NonNullable<VetVisitInput["medications"]> = [];
  for (const item of d.items) {
    if (item.kind === "treatment") {
      health_events.push({
        type: item.type,
        title: item.title,
        product: item.product || undefined,
        preset_id: item.presetId ?? undefined,
        next_due_on: effectiveNextDue(item, d.visitDate) || undefined,
        remind: item.remind,
      });
    } else if (item.kind === "other") {
      health_events.push({
        type: item.type,
        title: item.title,
        notes: item.notes || undefined,
      });
    } else {
      medications.push({
        name: item.name,
        dose: item.dose || undefined,
        schedule_rrule: buildRRule(item.draft) ?? undefined,
        starts_on: d.visitDate,
        ends_on: endsOn({ ...item.draft, startsOn: d.visitDate }) ?? undefined,
        notes:
          item.draft.frequency === "other" && item.otherFrequency
            ? `Frequência: ${item.otherFrequency}`
            : undefined,
        remind: item.remind,
      });
    }
  }

  let weight_kg: number | undefined;
  if (d.weight !== null) {
    const kg = parseKg(d.weight);
    if (kg === null) {
      errors.weight_kg = "Escreve o peso, por exemplo 12,4.";
    } else {
      weight_kg = kg;
    }
  }

  let expense: VetVisitInput["expense"];
  if (d.cost.trim() !== "") {
    const cents = parseEuroToCents(d.cost);
    if (cents === null) {
      errors["expense.amount_cents"] = "Escreve o valor, por exemplo 45,00.";
    } else if (cents > 0) {
      expense = {
        amount_cents: cents,
        category: "veterinary",
        paid_by: d.paidBy ?? undefined,
      };
    }
  }

  const payload: VetVisitInput = {
    pet_id: d.petId,
    visited_on: d.visitDate || undefined,
    reason: d.reason,
    vet_name: d.vet,
    notes: d.notes,
    weight_kg,
    health_events,
    medications,
    expense,
    document_id: d.documentId ?? undefined,
  };

  const parsed = vetVisitSchema.safeParse(payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
  }
  return { payload, errors };
}
