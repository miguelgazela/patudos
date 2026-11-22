export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export const FROM = { name: "Patudos", email: "patudos@miguelgazela.com" };

export type EmailTransport = (email: Email) => Promise<void>;

/** Produção: API HTTP do Resend. A key é só de servidor (nunca `NEXT_PUBLIC_`). */
export function resendTransport(apiKey: string): EmailTransport {
  return async (email) => {
    const res = await fetch("https://api.resend.com/emails", {
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

/** Local e e2e: API de envio do Mailpit (o mesmo que recebe os códigos do Supabase local). */
export function mailpitTransport(baseUrl: string): EmailTransport {
  return async (email) => {
    const res = await fetch(`${baseUrl}/api/v1/send`, {
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

/** Escolhe o transporte pelo ambiente. Sem nenhum configurado, o envio falha (o convite fica criado). */
export function getTransport(
  env: Record<string, string | undefined> = process.env,
): EmailTransport {
  if (env.RESEND_API_KEY) return resendTransport(env.RESEND_API_KEY);
  if (env.MAILPIT_URL) return mailpitTransport(env.MAILPIT_URL);
  return async () => {
    throw new Error("Sem transporte de email configurado.");
  };
}
