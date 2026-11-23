import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** Perfil de quem tem sessão. Sem sessão → /entrar. Uma só consulta por pedido (layout + página). */
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, reminder_emails")
    .eq("id", data.claims.sub)
    .single();
  if (!profile) redirect("/entrar");

  return profile;
});
