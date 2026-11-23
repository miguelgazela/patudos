// Conteúdo das notificações e dos emails de lembrete (puro: sem I/O, testável).
// Todo o texto que vem dos utilizadores (nome do animal, título, produto, nomes) é escapado.

export type Recipient = {
  user_id: string;
  email: string | null;
  name: string | null;
  /** Falso = desligou os emails de lembrete (ausente = ligado). */
  reminder_emails?: boolean;
};

/** Uma ocorrência reclamada por `claim_due_reminders`. */
export type ClaimedReminder = {
  occurrence_id: string;
  pet_id: string;
  pet_name: string;
  title: string;
  scheduled_for: string;
  source_type: "health_event" | "medication" | null;
  push: boolean;
  email: boolean;
  last: {
    product: string | null;
    occurred_on: string;
    by: string | null;
  } | null;
  dose: string | null;
  recipients: Recipient[];
};

export type PushPayload = {
  title: string;
  body: string;
  /** Uma notificação por ocorrência: reenviar substitui em vez de empilhar. */
  tag: string;
  /** Para onde o toque na notificação leva. */
  url: string;
  occurrenceId: string;
};

export type EmailContent = { subject: string; html: string; text: string };

const TZ = "Europe/Lisbon";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clean(s: string | null | undefined): string {
  // Sem quebras de linha nem caracteres de controlo (cabeçalhos, notificações).
  return (s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function lisbonISO(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function lisbonTime(d: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

function dayMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function dayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function weekday(d: Date): string {
  const w = new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    weekday: "long",
  }).format(d);
  return w.replace(/-feira$/, "");
}

function daysApart(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

/** «É hoje · segunda, 21/12/2026» (ou «Era para ontem · …» se o envio atrasou). */
export function whenLine(scheduledFor: string, now: Date = new Date()): string {
  const at = new Date(scheduledFor);
  const gap = daysApart(lisbonISO(at), lisbonISO(now));
  const date = `${weekday(at)}, ${dayMonthYear(lisbonISO(at))}`;
  if (gap <= 0) return `É hoje · ${date}`;
  if (gap === 1) return `Era para ontem · ${date}`;
  return `Em atraso · ${date}`;
}

/** «Da última vez: Pipeta Advantix, a 21/11, pelo Pedro.» (partes em falta saem). */
export function lastTimeLine(item: ClaimedReminder): string | null {
  if (!item.last) return null;
  const product = clean(item.last.product);
  const by = clean(item.last.by);
  const parts = [product || null, `a ${dayMonth(item.last.occurred_on)}`];
  if (by) parts.push(`pelo ${by}`);
  return `Da última vez: ${parts.filter(Boolean).join(", ")}.`;
}

function headline(item: ClaimedReminder): string {
  return `${clean(item.pet_name)} · ${clean(item.title)}`;
}

export function openUrl(appUrl: string, occurrenceId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/?ocorrencia=${encodeURIComponent(occurrenceId)}`;
}

export function preferencesUrl(appUrl: string, petId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/animais/${encodeURIComponent(petId)}/lembretes`;
}

export function pushPayload(
  item: ClaimedReminder,
  now: Date = new Date(),
): PushPayload {
  const at = new Date(item.scheduled_for);
  let body: string;
  if (item.source_type === "medication") {
    const dose = clean(item.dose);
    body = `Às ${lisbonTime(at)}${dose ? ` · ${dose}` : ""}`;
  } else {
    const today = lisbonISO(at) === lisbonISO(now);
    const last = item.last?.product
      ? `Da última vez: ${clean(item.last.product)}.`
      : "";
    body = [today ? "É hoje." : "Está em atraso.", last]
      .filter(Boolean)
      .join(" ");
  }
  return {
    title: headline(item),
    body,
    tag: `ocorrencia-${item.occurrence_id}`,
    url: `/?ocorrencia=${encodeURIComponent(item.occurrence_id)}`,
    occurrenceId: item.occurrence_id,
  };
}

export function emailContent(
  item: ClaimedReminder,
  appUrl: string,
  now: Date = new Date(),
): EmailContent {
  const pet = escapeHtml(clean(item.pet_name));
  const title = escapeHtml(clean(item.title));
  const when = escapeHtml(whenLine(item.scheduled_for, now));
  const last = lastTimeLine(item);
  const open = escapeHtml(openUrl(appUrl, item.occurrence_id));
  const prefs = escapeHtml(preferencesUrl(appUrl, item.pet_id));
  const initial = escapeHtml(
    Array.from(clean(item.pet_name))[0]?.toUpperCase() ?? "🐾",
  );

  const html = `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${pet} · ${title}</title></head>
<body style="margin:0;background:#F2F5F4;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;color:#0E1F1C">
<div style="max-width:600px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 20px;font-size:24px;font-weight:800;letter-spacing:-.03em;color:#0B6B5F">patudos</p>
<div style="background:#FFFFFF;border-radius:28px;padding:32px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr>
<td style="width:64px;height:64px;border-radius:32px;background:#D5EEE9;color:#0B6B5F;text-align:center;font-size:28px;font-weight:800;line-height:64px">${initial}</td>
<td style="padding-left:16px"><p style="margin:0;font-size:16px;font-weight:800;color:#B84A0C">${pet}</p>
<h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.02em">${title}</h1></td>
</tr></table>
<div style="background:#FFF1C7;color:#5A3E00;border-radius:18px;padding:16px 18px;font-size:19px;font-weight:800;margin:0 0 18px">${when}</div>
${last ? `<p style="margin:0 0 18px;font-size:16px;color:#2D403C">${escapeHtml(last)}</p>` : ""}
<a href="${open}" style="display:block;background:#0B6B5F;color:#FFFFFF;text-decoration:none;text-align:center;border-radius:999px;padding:18px 20px;font-size:18px;font-weight:800">Abrir e marcar como feito</a>
<p style="margin:18px 0 0;font-size:15px;color:#475A56">Quando alguém marcar como feito, deixas de receber este aviso.</p>
</div>
<p style="margin:20px 0 0;font-size:13px;color:#475A56;text-align:center">Recebes este email porque tens os lembretes de ${pet} ligados. <a href="${prefs}" style="color:#0B6B5F;font-weight:700">Mudar preferências</a></p>
</div></body></html>`;

  const text = [
    headline(item),
    "",
    whenLine(item.scheduled_for, now),
    ...(last ? ["", last] : []),
    "",
    `Abrir e marcar como feito: ${openUrl(appUrl, item.occurrence_id)}`,
    "Quando alguém marcar como feito, deixas de receber este aviso.",
    "",
    `Mudar preferências: ${preferencesUrl(appUrl, item.pet_id)}`,
  ].join("\n");

  return { subject: headline(item), html, text };
}

/** Destinatários com email (e com os emails de lembrete ligados), sem repetidos. */
export function emailRecipients(item: ClaimedReminder): Recipient[] {
  const seen = new Set<string>();
  return item.recipients.filter((r) => {
    // `reminder_emails === false`: a pessoa desligou os emails de lembrete no Perfil.
    if (!r.email || r.reminder_emails === false || seen.has(r.email))
      return false;
    seen.add(r.email);
    return true;
  });
}
