"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const kindSchema = z.enum(["evento", "medicacao", "peso"]);
const idSchema = z.uuid();

const TABLE = {
  evento: "health_events",
  medicacao: "medications",
  peso: "weights",
} as const;

export type RecordResult =
  { ok: true; petId: string } | { ok: false; message: string };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return supabase;
}

/** Apagar um registo (vacina, medicação, peso…). A RLS só deixa o dono ou quem o criou. */
export async function deleteRecord(
  kind: unknown,
  id: unknown,
): Promise<RecordResult> {
  const k = kindSchema.safeParse(kind);
  const i = idSchema.safeParse(id);
  if (!k.success || !i.success) {
    return { ok: false, message: "Não conseguimos apagar este registo." };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from(TABLE[k.data])
    .delete()
    .eq("id", i.data)
    .select("id, pet_id");
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      message:
        "Não conseguimos apagar. Só o dono ou quem registou o pode fazer.",
    };
  }
  revalidatePath(`/animais/${row.pet_id}`, "layout");
  revalidatePath("/animais");
  return { ok: true, petId: row.pet_id };
}

/** «Terminar medicação»: a última toma passa a ser hoje. */
export async function endMedication(id: unknown): Promise<RecordResult> {
  const i = idSchema.safeParse(id);
  if (!i.success) {
    return { ok: false, message: "Não conseguimos terminar a medicação." };
  }
  const supabase = await requireUser();
  const { data: med } = await supabase
    .from("medications")
    .select("starts_on")
    .eq("id", i.data)
    .maybeSingle();
  const today = todayISO();
  // A data de fim não pode ser anterior ao início (ex.: medicação que só começa amanhã).
  const endsOn = med && med.starts_on > today ? med.starts_on : today;
  const { data, error } = await supabase
    .from("medications")
    .update({ ends_on: endsOn })
    .eq("id", i.data)
    .select("id, pet_id");
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      message:
        "Não conseguimos terminar. Só o dono ou quem registou a medicação o pode fazer.",
    };
  }
  revalidatePath(`/animais/${row.pet_id}`, "layout");
  return { ok: true, petId: row.pet_id };
}
