"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { LAST_PET_COOKIE } from "@/lib/vet-visits/data";

import { expenseInputSchema } from "./schema";

export type ExpenseResult =
  | { ok: true; id: string; petId: string | null }
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

/** Ecrã 26: valida (Zod) e grava despesa + splits numa só chamada à RPC `save_expense`. */
export async function saveExpense(input: unknown): Promise<ExpenseResult> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Confirma os campos assinalados.",
      errors: fieldErrors(parsed.error),
    };
  }
  const supabase = await requireUser();
  const { data, error } = await supabase.rpc("save_expense", {
    payload: parsed.data,
  });
  if (error || !data) {
    // As mensagens 23514 (soma, animais) e 42501 (permissões) da função já vêm em PT-PT.
    const known = error?.code === "23514" || error?.code === "42501";
    return { ok: false, message: known ? error.message : GENERIC };
  }

  const petId = parsed.data.splits?.[0]?.pet_id ?? null;
  if (petId) {
    (await cookies()).set(LAST_PET_COOKIE, petId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  revalidatePath("/despesas");
  revalidatePath("/animais");
  return { ok: true, id: data, petId };
}

/** Apagar (RLS: quem criou, ou o dono de todos os animais da despesa). */
export async function deleteExpense(id: string): Promise<ExpenseResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.[0]) {
    return {
      ok: false,
      message:
        "Não conseguimos apagar. Só quem registou a despesa ou o dono dos animais o pode fazer.",
    };
  }
  revalidatePath("/despesas");
  revalidatePath("/animais");
  return { ok: true, id, petId: null };
}
