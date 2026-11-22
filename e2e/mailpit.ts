const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";

type Summary = { ID: string; Created: string };

/** Espera pelo email mais recente para `to` e devolve o código de 6 dígitos. */
export async function latestCode(to: string, notBefore = 0): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const { messages = [] } = (await res.json()) as { messages?: Summary[] };
    const fresh = messages.filter((m) => Date.parse(m.Created) >= notBefore);
    const newest = fresh[0]; // o Mailpit devolve do mais recente para o mais antigo
    if (newest) {
      const msg = (await (
        await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)
      ).json()) as { Text: string; HTML: string };
      if (/href=/i.test(msg.HTML)) throw new Error("O email tem uma ligação.");
      const code = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Sem email para ${to}`);
}
