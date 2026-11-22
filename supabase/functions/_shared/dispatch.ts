// Orquestra o envio de uma lista de ocorrências já reclamadas (ver `claim_due_reminders`).
// Tudo o que toca no exterior entra por `deps`, por isso testa-se sem rede nem base de dados.

import {
  emailContent,
  emailRecipients,
  pushPayload,
  type ClaimedReminder,
  type EmailContent,
  type PushPayload,
} from "./content.ts";
import type { PushResult } from "./webpush.ts";

export type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type DispatchDeps = {
  appUrl: string;
  now?: () => Date;
  /** Subscrições push dos utilizadores indicados. */
  subscriptionsFor: (userIds: string[]) => Promise<Subscription[]>;
  sendPush: (sub: Subscription, payload: PushPayload) => Promise<PushResult>;
  /** `null` = sem transporte de email configurado. */
  sendEmail: ((to: string, content: EmailContent) => Promise<void>) | null;
  deleteSubscription: (id: string) => Promise<void>;
  touchSubscription: (id: string) => Promise<void>;
  /** Devolve o «claim» de um canal para nova tentativa. */
  release: (occurrenceId: string, channel: "push" | "email") => Promise<void>;
  log?: (msg: string) => void;
};

export type DispatchStats = {
  occurrences: number;
  pushSent: number;
  pushFailed: number;
  pushRemoved: number;
  emailSent: number;
  emailFailed: number;
  released: number;
};

export async function dispatchReminders(
  items: ClaimedReminder[],
  deps: DispatchDeps,
): Promise<DispatchStats> {
  const now = deps.now?.() ?? new Date();
  const log = deps.log ?? (() => {});
  const stats: DispatchStats = {
    occurrences: items.length,
    pushSent: 0,
    pushFailed: 0,
    pushRemoved: 0,
    emailSent: 0,
    emailFailed: 0,
    released: 0,
  };

  for (const item of items) {
    if (item.push) {
      const subs = await deps.subscriptionsFor(
        item.recipients.map((r) => r.user_id),
      );
      const payload = pushPayload(item, now);
      let delivered = 0;
      let transientFailures = 0;
      for (const sub of subs) {
        try {
          const res = await deps.sendPush(sub, payload);
          if (res.ok) {
            delivered++;
            stats.pushSent++;
            await deps.touchSubscription(sub.id);
          } else if (res.gone) {
            stats.pushRemoved++;
            await deps.deleteSubscription(sub.id);
          } else {
            transientFailures++;
            stats.pushFailed++;
            log(`push ${res.status} (${item.occurrence_id})`);
          }
        } catch (e) {
          transientFailures++;
          stats.pushFailed++;
          log(
            `push erro (${item.occurrence_id}): ${e instanceof Error ? e.message : e}`,
          );
        }
      }
      // Falha total e temporária (nenhuma entrega, e nenhuma morta): tenta no ciclo seguinte.
      if (subs.length > 0 && delivered === 0 && transientFailures > 0) {
        await deps.release(item.occurrence_id, "push");
        stats.released++;
      }
    }

    if (item.email) {
      const recipients = emailRecipients(item);
      if (!deps.sendEmail) {
        // Sem transporte configurado: devolve o claim para não perder o lembrete.
        if (recipients.length > 0) {
          await deps.release(item.occurrence_id, "email");
          stats.released++;
        }
        log("sem transporte de email configurado");
        continue;
      }
      const content = emailContent(item, deps.appUrl, now);
      let delivered = 0;
      for (const r of recipients) {
        try {
          await deps.sendEmail(r.email as string, content);
          delivered++;
          stats.emailSent++;
        } catch (e) {
          stats.emailFailed++;
          log(
            `email erro (${item.occurrence_id}): ${e instanceof Error ? e.message : e}`,
          );
        }
      }
      if (recipients.length > 0 && delivered === 0) {
        await deps.release(item.occurrence_id, "email");
        stats.released++;
      }
    }
  }
  return stats;
}
