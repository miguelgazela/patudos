"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { LAST_PET_COOKIE } from "./data";
import {
  homeTreatmentSchema,
  quickWeightSchema,
  vetVisitSchema,
  visitEditSchema,
} from "./schema";

export type SaveResult =
  | { ok: true; visitId: string; petId: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const GENERIC =
  "Não conseguimos guardar. Os dados continuam aqui; tenta de novo.";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return supabase;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.join(".") || "form"] ??= issue.message;
  }
  return errors;
}

/** Ecrã 13: valida (Zod) e grava tudo numa só chamada à RPC `record_vet_visit`. */
export async function saveVetVisit(input: unknown): Promise<SaveResult> {
  const parsed = vetVisitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: fieldErrors(parsed.error),
    };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("record_vet_visit", {
    payload: parsed.data,
  });
  if (error || !data) return { ok: false, message: GENERIC };

  (await cookies()).set(LAST_PET_COOKIE, parsed.data.pet_id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/animais");
  return { ok: true, visitId: data, petId: parsed.data.pet_id };
}

/** Editar os campos da consulta (RLS: dono ou quem a criou). */
export async function updateVetVisit(
  visitId: string,
  input: unknown,
): Promise<SaveResult> {
  const parsed = visitEditSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(visitId).success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: parsed.success ? {} : fieldErrors(parsed.error),
    };
  }
  const supabase = await requireUser();
  const { visited_on, reason, vet_name, notes } = parsed.data;
  const { data, error } = await supabase
    .from("vet_visits")
    .update({
      ...(visited_on ? { visited_on } : {}),
      reason,
      vet_name: vet_name ?? null,
      notes: notes ?? null,
    })
    .eq("id", visitId)
    .select("id, pet_id");
  const row = data?.[0];
  if (error || !row) return { ok: false, message: GENERIC };

  revalidatePath(`/animais/${row.pet_id}`);
  return { ok: true, visitId: row.id, petId: row.pet_id };
}

/**
 * Apagar a consulta: um só DELETE (transacional). Pesos, vacinas, medicação, despesa e
 * documentos ficam e só perdem a ligação (FK `on delete set null`).
 */
export async function deleteVetVisit(visitId: string): Promise<SaveResult> {
  if (!z.uuid().safeParse(visitId).success) {
    return { ok: false, message: GENERIC };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("vet_visits")
    .delete()
    .eq("id", visitId)
    .select("id, pet_id");
  const row = data?.[0];
  if (error || !row) {
    return {
      ok: false,
      message:
        "Não conseguimos apagar. Só o dono ou quem registou a consulta o pode fazer.",
    };
  }
  revalidatePath(`/animais/${row.pet_id}`);
  revalidatePath("/animais");
  return { ok: true, visitId: row.id, petId: row.pet_id };
}

async function rememberPet(petId: string) {
  (await cookies()).set(LAST_PET_COOKIE, petId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export type QuickResult =
  | { ok: true; id: string; petId: string }
  | { ok: false; message: string; errors?: Record<string, string> };

/** Ecrã 17: peso fora de consulta (RPC `record_weight`). */
export async function saveWeight(input: unknown): Promise<QuickResult> {
  const parsed = quickWeightSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: fieldErrors(parsed.error),
    };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("record_weight", {
    payload: parsed.data,
  });
  if (error || !data) return { ok: false, message: GENERIC };
  await rememberPet(parsed.data.pet_id);
  revalidatePath("/animais");
  revalidatePath(`/animais/${parsed.data.pet_id}`);
  return { ok: true, id: data, petId: parsed.data.pet_id };
}

/** Ecrã 16: tratamento em casa, com despesa opcional (RPC `record_home_treatment`). */
export async function saveHomeTreatment(input: unknown): Promise<QuickResult> {
  const parsed = homeTreatmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: fieldErrors(parsed.error),
    };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("record_home_treatment", {
    payload: parsed.data,
  });
  if (error || !data) return { ok: false, message: GENERIC };
  await rememberPet(parsed.data.pet_id);
  revalidatePath("/animais");
  revalidatePath(`/animais/${parsed.data.pet_id}`);
  return { ok: true, id: data, petId: parsed.data.pet_id };
}
