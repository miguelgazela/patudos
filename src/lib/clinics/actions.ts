"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { clinicDetailsSchema } from "./schema";

export type ClinicResult =
  | { ok: true }
  | { ok: false; message: string; errors?: Record<string, string> };

const GENERIC = "Não conseguimos guardar. Tenta de novo.";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return supabase;
}

function refresh(petId: string) {
  revalidatePath(`/animais/${petId}`);
  revalidatePath(`/animais/${petId}/clinica`);
  revalidatePath("/registar/consulta");
}

/** Clínica habitual do animal (só o dono, garantido pelo RLS). `null` = nenhuma. */
export async function setHabitualClinic(
  petId: string,
  clinicId: string | null,
): Promise<ClinicResult> {
  if (
    !z.uuid().safeParse(petId).success ||
    (clinicId !== null && !z.uuid().safeParse(clinicId).success)
  ) {
    return { ok: false, message: GENERIC };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("pets")
    .update({ clinic_id: clinicId })
    .eq("id", petId)
    .select("id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: "Só o dono do animal pode mudar a clínica habitual.",
    };
  }
  refresh(petId);
  return { ok: true };
}

/** Nome, telefone e morada (quem criou a clínica ou o dono de um animal que a tem como habitual). */
export async function updateClinic(
  clinicId: string,
  petId: string,
  input: unknown,
): Promise<ClinicResult> {
  const parsed = clinicDetailsSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(clinicId).success) {
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        errors[i.path.join(".") || "form"] ??= i.message;
      }
    }
    return { ok: false, message: "Confirma os campos assinalados.", errors };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("clinics")
    .update(parsed.data)
    .eq("id", clinicId)
    .select("id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: "Só o dono do animal ou quem criou a clínica a pode alterar.",
    };
  }
  refresh(petId);
  return { ok: true };
}

/** Nova clínica (reutiliza uma com o mesmo nome) e passa a ser a habitual do animal. */
export async function createHabitualClinic(
  petId: string,
  input: unknown,
): Promise<ClinicResult> {
  const parsed = clinicDetailsSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(petId).success) {
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        errors[i.path.join(".") || "form"] ??= i.message;
      }
    }
    return { ok: false, message: "Confirma os campos assinalados.", errors };
  }
  const supabase = await requireUser();
  const { data: id, error } = await supabase.rpc("find_or_create_clinic", {
    p_name: parsed.data.name,
  });
  if (error || !id) return { ok: false, message: GENERIC };
  // Telefone e morada (opcionais) só se foram escritos; o RLS limita quem os pode alterar.
  const extra = {
    ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
    ...(parsed.data.address ? { address: parsed.data.address } : {}),
  };
  if (Object.keys(extra).length) {
    await supabase.from("clinics").update(extra).eq("id", id);
  }
  return setHabitualClinic(petId, id);
}
