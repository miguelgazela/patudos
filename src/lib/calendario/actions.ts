"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type RegenerateResult = { ok: true } | { ok: false; message: string };

/** Gera um link novo; o anterior deixa de funcionar. */
export async function regenerateCalendarLink(): Promise<RegenerateResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  const { error } = await supabase.rpc("regenerate_calendar_token");
  if (error) {
    return {
      ok: false,
      message: "Não conseguimos gerar o link. Tenta de novo.",
    };
  }
  revalidatePath("/perfil/calendario");
  return { ok: true };
}
