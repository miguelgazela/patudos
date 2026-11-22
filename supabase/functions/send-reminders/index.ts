// Edge Function `send-reminders`: envia por push e email as ocorrências de lembretes devidas.
//
// Chamada pelo pg_cron (via pg_net) de 5 em 5 minutos, com o segredo partilhado no cabeçalho
// `x-cron-secret`. O JWT não é verificado (`verify_jwt = false`): quem autentica é o segredo.
// O service role (SUPABASE_SERVICE_ROLE_KEY) é injetado pelo Supabase e nunca sai daqui.
//
// Secrets (supabase secrets set): CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
// RESEND_API_KEY, APP_URL. Em local: supabase/functions/.env (com MAILPIT_URL em vez do Resend).

import { createClient } from "npm:@supabase/supabase-js@2";

import type { ClaimedReminder } from "../_shared/content.ts";
import { dispatchReminders, type Subscription } from "../_shared/dispatch.ts";
import { pickSender } from "../_shared/email-transport.ts";
import { sendWebPush, type VapidConfig } from "../_shared/webpush.ts";

const env = (k: string) => Deno.env.get(k) ?? undefined;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** «Enviar notificação de teste»: só para as subscrições de quem pediu (JWT verificado aqui). */
async function sendTestPush(
  supabase: ReturnType<typeof createClient>,
  jwt: string,
  vapid: VapidConfig | null,
): Promise<Response> {
  const { data: auth, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !auth.user) return json({ error: "unauthorized" }, 401);
  if (!vapid) return json({ error: "config: vapid" }, 500);

  const { data: subs, error } = await supabase.rpc("push_subscriptions_for", {
    p_user_ids: [auth.user.id],
  });
  if (error) return json({ error: "subscriptions" }, 500);
  const payload = {
    title: "Patudos",
    body: "Está tudo a funcionar. 🐾",
    tag: "teste",
    url: "/perfil/notificacoes",
  };
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const sub of (subs ?? []) as Subscription[]) {
    try {
      const res = await sendWebPush(sub, payload, vapid);
      if (res.ok) sent++;
      else if (res.gone) {
        removed++;
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else failed++;
    } catch {
      failed++;
    }
  }
  return json({ ok: true, sent, removed, failed });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const secret = env("CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  const bearer = /^Bearer (.+)$/.exec(
    req.headers.get("authorization") ?? "",
  )?.[1];
  const isCron = !!secret && given !== "" && safeEqual(secret, given);
  // Sem segredo do cron, só se aceita o modo de teste: JWT de um utilizador, só para as suas subscrições.
  if (!isCron && !bearer) return json({ error: "unauthorized" }, 401);

  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "config: supabase" }, 500);
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const vapid: VapidConfig | null =
    env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY")
      ? {
          publicKey: env("VAPID_PUBLIC_KEY")!,
          privateKey: env("VAPID_PRIVATE_KEY")!,
          subject: env("VAPID_SUBJECT") ?? "mailto:patudos@miguelgazela.com",
        }
      : null;
  const emailSender = pickSender({
    RESEND_API_KEY: env("RESEND_API_KEY"),
    MAILPIT_URL: env("MAILPIT_URL"),
  });
  const appUrl = env("APP_URL") ?? "https://patudos-five.vercel.app";

  if (!isCron) {
    return await sendTestPush(supabase, bearer!, vapid);
  }

  const totals = {
    occurrences: 0,
    pushSent: 0,
    pushFailed: 0,
    pushRemoved: 0,
    emailSent: 0,
    emailFailed: 0,
    released: 0,
  };

  // Até 5 lotes por chamada; o ciclo seguinte apanha o resto.
  for (let batch = 0; batch < 5; batch++) {
    const { data, error } = await supabase.rpc("claim_due_reminders", {
      p_limit: 100,
    });
    if (error)
      return json({ error: "claim", message: error.message, ...totals }, 500);
    const items = (data ?? []) as ClaimedReminder[];
    if (items.length === 0) break;

    const stats = await dispatchReminders(items, {
      appUrl,
      subscriptionsFor: async (userIds) => {
        if (userIds.length === 0) return [];
        const { data: subs, error: e } = await supabase.rpc(
          "push_subscriptions_for",
          {
            p_user_ids: userIds,
          },
        );
        if (e) throw new Error(e.message);
        return (subs ?? []) as Subscription[];
      },
      sendPush: (sub, payload) =>
        vapid
          ? sendWebPush(sub, payload, vapid)
          : Promise.reject(new Error("VAPID não configurado")),
      sendEmail: emailSender
        ? (to, content) => emailSender({ to, ...content })
        : null,
      deleteSubscription: async (id) => {
        await supabase.from("push_subscriptions").delete().eq("id", id);
      },
      touchSubscription: async (id) => {
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", id);
      },
      release: async (occurrenceId, channel) => {
        await supabase.rpc("release_reminder_claim", {
          p_occurrence_id: occurrenceId,
          p_channel: channel,
        });
      },
      log: (m) => console.warn(m),
    });
    for (const k of Object.keys(totals) as (keyof typeof totals)[])
      totals[k] += stats[k];
    if (items.length < 100) break;
  }

  return json({ ok: true, ...totals });
});
