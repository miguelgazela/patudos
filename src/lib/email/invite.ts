/** Email do convite (M-Email-convite). Nunca leva código nem link de login: só abre a app. */

export type InviteEmailInput = {
  inviterName: string;
  petName: string;
  /** Email do convidado (para onde segue o convite). */
  to: string;
  /** Ligação para `/entrar` com o email pré-preenchido. */
  link: string;
  /** Cor de fundo do animal (hex) para a inicial. */
  accent?: string;
  /** O animal faleceu: o convite é para ver o tributo e deixar memórias. */
  deceased?: boolean;
};

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** `https://…/entrar?email=…` */
export function inviteLink(origin: string, email: string): string {
  return `${origin.replace(/\/$/, "")}/entrar?email=${encodeURIComponent(email)}`;
}

export function inviteSubject(
  inviterName: string,
  petName: string,
  deceased = false,
) {
  return deceased
    ? `${inviterName} convidou-te para recordar ${petName}`
    : `${inviterName} convidou-te para cuidar de ${petName}`;
}

export function inviteEmail(i: InviteEmailInput) {
  const inviter = esc(i.inviterName);
  const pet = esc(i.petName);
  const to = esc(i.to);
  const link = esc(i.link);
  const accent = i.accent ?? "#D9580F";
  const initial = esc(i.petName.charAt(0).toUpperCase());
  const title = i.deceased
    ? `${inviter} convidou-te para recordar ${pet}`
    : `${inviter} convidou-te para cuidar de ${pet}`;
  const body = i.deceased
    ? `No Patudos vais poder ver o tributo a ${pet}, o historial de saúde e deixar as tuas memórias.`
    : `No Patudos vais poder ver o historial de ${pet}, registar consultas, pesos e despesas, e receber os lembretes.`;
  const textTitle = i.deceased
    ? `${i.inviterName} convidou-te para recordar ${i.petName}`
    : `${i.inviterName} convidou-te para cuidar de ${i.petName}`;
  const textBody = i.deceased
    ? `No Patudos vais poder ver o tributo a ${i.petName}, o historial de saúde e deixar as tuas memórias.`
    : `No Patudos vais poder ver o historial de ${i.petName}, registar consultas, pesos e despesas, e receber os lembretes.`;

  const html = `<!doctype html>
<html lang="pt-PT"><body style="margin:0;background:#F2F5F4;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0E1F1C">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 20px;font-size:24px;font-weight:800;letter-spacing:-.03em">patudos</p>
  <div style="background:#FFFFFF;border-radius:28px;overflow:hidden">
    <div style="background:#FDE7D9;padding:28px;text-align:center">
      <span style="display:inline-block;width:120px;height:120px;line-height:120px;border-radius:60px;background:${accent};color:#FFFFFF;font-size:52px;font-weight:800">${initial}</span>
    </div>
    <div style="padding:28px 32px 32px">
      <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.02em">${title}</h1>
      <p style="margin:0 0 22px;font-size:17px;line-height:1.55;color:#2D403C">${body}</p>
      <a href="${link}" style="display:block;background:#0B6B5F;color:#FFFFFF;text-align:center;text-decoration:none;font-size:18px;font-weight:800;line-height:60px;border-radius:30px">Abrir o Patudos</a>
      <p style="margin:18px 0 0;font-size:15px;color:#475A56">Entras com este email: <b style="color:#0E1F1C">${to}</b>. Não precisas de palavra-passe: enviamos-te um código.</p>
    </div>
  </div>
  <div style="background:#FFFFFF;border-radius:28px;padding:24px 32px;margin-top:16px">
    <h2 style="margin:0 0 10px;font-size:20px;font-weight:800">No iPhone, instala assim</h2>
    <p style="margin:0 0 8px;font-size:16px;font-weight:600"><b style="color:#0B6B5F">1.</b> Abre o link no Safari</p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:600"><b style="color:#0B6B5F">2.</b> Toca em Partilhar e depois em «Adicionar ao ecrã principal»</p>
    <p style="margin:0;font-size:16px;font-weight:600"><b style="color:#0B6B5F">3.</b> Abre o Patudos pelo ícone novo</p>
  </div>
  <p style="margin:16px 0 0;font-size:13px;color:#475A56;text-align:center">Não conheces ${inviter}? Ignora este email.</p>
</div></body></html>`;

  const text = `${textTitle}

${textBody}

Abre o Patudos: ${i.link}

Entras com este email (${i.to}). Não precisas de palavra-passe: enviamos-te um código.

No iPhone, instala assim:
1. Abre o link no Safari
2. Toca em Partilhar e depois em «Adicionar ao ecrã principal»
3. Abre o Patudos pelo ícone novo

Não conheces ${i.inviterName}? Ignora este email.`;

  return {
    subject: inviteSubject(i.inviterName, i.petName, i.deceased),
    html,
    text,
  };
}
