"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Interruptor «Emails de lembrete» do Perfil (só o próprio, por RLS). */
export async function setReminderEmails(on: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ reminder_emails: on })
    .eq("id", data.claims.sub)
    .select("id");
  if (error || !rows?.length) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}
