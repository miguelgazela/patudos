import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { ClinicInfo } from "./clinic";

/**
 * Clínicas que o utilizador vê (RLS): as que criou ou que estão ligadas a animais seus.
 * Servem de sugestão em todos os animais.
 */
export async function getKnownClinics(): Promise<ClinicInfo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinics")
    .select("id, name, phone, address")
    .order("name");
  return data ?? [];
}
