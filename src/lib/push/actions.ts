"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type PushResult = { ok: true } | { ok: false; message: string };

const GENERIC = "Não conseguimos ativar as notificações. Tenta de novo.";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(100),
  }),
  userAgent: z.string().max(300).optional(),
});

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/entrar");
  return supabase;
}

/** Guarda a subscrição deste dispositivo (idempotente: o endpoint é único). */
export async function savePushSubscription(
  input: unknown,
): Promise<PushResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: parsed.data.userAgent,
  });
  if (error) return { ok: false, message: GENERIC };
  return { ok: true };
}

/** Desliga as notificações deste dispositivo. */
export async function removePushSubscription(
  endpoint: unknown,
): Promise<PushResult> {
  const parsed = z.url().safeParse(endpoint);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const supabase = await requireUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data);
  if (error) return { ok: false, message: GENERIC };
  return { ok: true };
}

/**
 * «Enviar notificação de teste»: pede à Edge Function que envie para as subscrições
 * de quem está com sessão. A chave privada VAPID vive só no Supabase, nunca na Vercel.
 */
export async function sendTestNotification(): Promise<
  { ok: true; sent: number } | { ok: false; message: string }
> {
  const supabase = await requireUser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !base)
    return { ok: false, message: "Não conseguimos enviar o teste." };
  try {
    const res = await fetch(`${base}/functions/v1/send-reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok)
      return { ok: false, message: "Não conseguimos enviar o teste." };
    const body = (await res.json()) as { sent?: number };
    return { ok: true, sent: body.sent ?? 0 };
  } catch {
    return { ok: false, message: "Não conseguimos enviar o teste." };
  }
}
