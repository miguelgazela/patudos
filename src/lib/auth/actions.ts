"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { acceptPendingInvites } from "@/lib/people/accept";
import { createClient } from "@/lib/supabase/server";

import { codeSchema, emailSchema, nameSchema } from "./schemas";
import {
  CODE_VALIDITY_MS,
  clearPendingLogin,
  readPendingLogin,
  savePendingLogin,
} from "./pending-login";

export type RequestCodeState = {
  email?: string;
  /** `invalid`: email mal escrito · `send`: falhou o envio. */
  error?: "invalid" | "send";
  message?: string;
};

/** Ecrã 2: pede o código por email. Nunca usa link (sem `emailRedirectTo`). */
export async function requestCode(
  _prev: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  const raw = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      email: raw,
      error: "invalid",
      message: parsed.error.issues[0]?.message,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return {
      email: raw,
      error: "send",
      message: "Não conseguimos enviar o código. Tenta de novo.",
    };
  }

  await savePendingLogin(parsed.data);
  redirect("/entrar/codigo");
}

export type VerifyCodeResult = { error: "wrong" | "expired" | "send" };

/** Ecrã 3: confirma o código de 6 dígitos. Em caso de sucesso segue para `/`. */
export async function verifyCode(code: string): Promise<VerifyCodeResult> {
  const pending = await readPendingLogin();
  if (!pending) redirect("/entrar");

  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return { error: "wrong" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: pending.email,
    token: parsed.data,
    type: "email",
  });
  if (error) {
    // O Supabase usa o mesmo erro para código errado e expirado:
    // distinguimos pela hora a que o enviámos.
    const expired = Date.now() - pending.sentAt > CODE_VALIDITY_MS;
    return { error: expired ? "expired" : "wrong" };
  }

  await clearPendingLogin();
  // Convites pendentes para este email: o cuidador entra e já vê o animal.
  await acceptPendingInvites(supabase);
  redirect("/");
}

/** Ecrã 3: reenvia o código para o mesmo email. */
export async function resendCode(): Promise<{ ok: boolean }> {
  const pending = await readPendingLogin();
  if (!pending) redirect("/entrar");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: pending.email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false };

  await savePendingLogin(pending.email);
  return { ok: true };
}

export type SaveNameState = { name?: string; message?: string };

/** Ecrã 4: grava o nome no perfil e segue para `/`. */
export async function saveName(
  _prev: SaveNameState,
  formData: FormData,
): Promise<SaveNameState> {
  const raw = String(formData.get("name") ?? "");
  const parsed = nameSchema.safeParse(raw);
  if (!parsed.success) {
    return { name: raw, message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");

  const { error } = await supabase
    .from("profiles")
    .update({ name: parsed.data })
    .eq("id", data.claims.sub);
  if (error) {
    return { name: raw, message: "Não conseguimos guardar. Tenta de novo." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export type UpdateNameState = {
  name?: string;
  message?: string;
  saved?: boolean;
};

/** Ecrã 29: edita o nome no perfil (fica no ecrã). */
export async function updateName(
  _prev: UpdateNameState,
  formData: FormData,
): Promise<UpdateNameState> {
  const raw = String(formData.get("name") ?? "");
  const parsed = nameSchema.safeParse(raw);
  if (!parsed.success) {
    return { name: raw, message: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");

  const { error } = await supabase
    .from("profiles")
    .update({ name: parsed.data })
    .eq("id", data.claims.sub);
  if (error) {
    return { name: raw, message: "Não conseguimos guardar. Tenta de novo." };
  }

  revalidatePath("/", "layout");
  return { name: parsed.data, saved: true };
}
