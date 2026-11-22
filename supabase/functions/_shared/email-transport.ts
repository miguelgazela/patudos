export type Email = { to: string; subject: string; html: string; text: string };
export type EmailSender = (email: Email) => Promise<void>;

const FROM = { name: "Patudos", email: "patudos@miguelgazela.com" };

/** Produção: API HTTP do Resend (`RESEND_API_KEY` nos secrets da função). */
export function resendSender(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): EmailSender {
  return async (email) => {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM.name} <${FROM.email}>`,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status}`);
  };
}

/** Local: API de envio do Mailpit. */
export function mailpitSender(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): EmailSender {
  return async (email) => {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: FROM.email, Name: FROM.name },
        To: [{ Email: email.to }],
        Subject: email.subject,
        HTML: email.html,
        Text: email.text,
      }),
    });
    if (!res.ok) throw new Error(`Mailpit: ${res.status}`);
  };
}

export function pickSender(
  env: Record<string, string | undefined>,
): EmailSender | null {
  if (env.RESEND_API_KEY) return resendSender(env.RESEND_API_KEY);
  if (env.MAILPIT_URL) return mailpitSender(env.MAILPIT_URL);
  return null;
}
