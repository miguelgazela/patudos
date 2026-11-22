"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { buildRRule } from "./recurrence";
import {
  completeTreatmentSchema,
  reminderSchema,
  type CompleteTreatmentInput,
  type ReminderInput,
} from "./schema";

export type Result =
  | { ok: true; petId?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const GENERIC = "Não conseguimos guardar. Tenta de novo.";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return supabase;
}

function refresh(petId?: string) {
  revalidatePath("/");
  if (petId) {
    revalidatePath(`/animais/${petId}`, "layout");
  }
}

/** «Feito» simples (medicação ou lembrete manual). */
export async function completeOccurrence(id: unknown): Promise<Result> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { error } = await supabase.rpc("complete_occurrence", {
    p_occurrence_id: parsed.data,
  });
  if (error) return { ok: false, message: GENERIC };
  refresh();
  return { ok: true };
}

/** «Desfazer» o «Feito» (qualquer membro). */
export async function undoOccurrence(id: unknown): Promise<Result> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { error } = await supabase.rpc("uncomplete_occurrence", {
    p_occurrence_id: parsed.data,
  });
  if (error) return { ok: false, message: GENERIC };
  refresh();
  return { ok: true };
}

/**
 * «Feito» de um tratamento: marca a ocorrência e regista o tratamento (mesmo tipo e título)
 * com a próxima data, tudo numa só transação (`complete_occurrence`).
 */
export async function completeTreatment(
  input: CompleteTreatmentInput,
): Promise<Result> {
  const parsed = completeTreatmentSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues)
      errors[i.path.join(".") || "form"] ??= i.message;
    return { ok: false, message: "Confirma os campos assinalados.", errors };
  }
  const v = parsed.data;
  const supabase = await requireUser();

  // O tipo, o título e o preset vêm do registo original, não do cliente.
  const { data: occ } = await supabase
    .from("reminder_occurrences")
    .select("pet_id, reminders(source_type, source_id)")
    .eq("id", v.occurrenceId)
    .maybeSingle();
  const eventId =
    occ?.reminders?.source_type === "health_event"
      ? occ.reminders.source_id
      : null;
  const { data: event } = eventId
    ? await supabase
        .from("health_events")
        .select("type, title, preset_id")
        .eq("id", eventId)
        .maybeSingle()
    : { data: null };
  if (!occ || !event) {
    return { ok: false, message: "Não encontrámos este tratamento." };
  }
  if (v.nextDueOn && v.nextDueOn < v.on) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: { nextDueOn: "A próxima data não pode ser anterior ao registo." },
    };
  }

  const { error } = await supabase.rpc("complete_occurrence", {
    p_occurrence_id: v.occurrenceId,
    p_treatment: {
      type: event.type,
      title: event.title,
      preset_id: event.preset_id,
      occurred_on: v.on,
      product: v.product || null,
      next_due_on: v.nextDueOn || null,
      remind: v.remind,
    },
  });
  if (error) return { ok: false, message: GENERIC };
  refresh(occ.pet_id);
  return { ok: true, petId: occ.pet_id };
}

/** Ecrã 23: cria ou edita um lembrete manual. */
export async function saveReminder(input: ReminderInput): Promise<Result> {
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues)
      errors[i.path.join(".") || "form"] ??= i.message;
    return { ok: false, message: "Confirma os campos assinalados.", errors };
  }
  const v = parsed.data;
  const supabase = await requireUser();
  const { error } = await supabase.rpc("save_reminder", {
    payload: {
      id: v.id,
      pet_id: v.pet_id,
      title: v.title,
      on: v.on,
      at: v.at,
      rrule: buildRRule(v.repeat),
      channels: v.channels,
    },
  });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "Não tens permissão para alterar este lembrete."
          : GENERIC,
    };
  }
  refresh(v.pet_id);
  revalidatePath(`/animais/${v.pet_id}/lembretes`);
  return { ok: true, petId: v.pet_id };
}

/** Pausar / retomar. A RLS só deixa o dono ou quem criou o lembrete. */
export async function setReminderActive(
  id: unknown,
  active: boolean,
): Promise<Result> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("reminders")
    .update({ active })
    .eq("id", parsed.data)
    .select("pet_id");
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      message: "Só o dono ou quem criou o lembrete o pode alterar.",
    };
  }
  refresh(row.pet_id);
  revalidatePath(`/animais/${row.pet_id}/lembretes`);
  return { ok: true, petId: row.pet_id };
}

export async function deleteReminder(id: unknown): Promise<Result> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", parsed.data)
    .select("pet_id");
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      message: "Só o dono ou quem criou o lembrete o pode apagar.",
    };
  }
  refresh(row.pet_id);
  revalidatePath(`/animais/${row.pet_id}/lembretes`);
  return { ok: true, petId: row.pet_id };
}
