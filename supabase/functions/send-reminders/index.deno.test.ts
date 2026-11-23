// Teste de integração da Edge Function contra o Supabase local.
//   supabase start && supabase functions serve   (noutro terminal)
//   npm run test:functions
// O email chega ao Mailpit; o push vai para um endpoint falso (servidor local) que
// responde 201, ou 410 para o caminho /gone.
import { assert, assertEquals } from "jsr:@std/assert@1";

import { b64urlEncode } from "../_shared/webpush.ts";

const API = Deno.env.get("SUPABASE_LOCAL_URL") ?? "http://127.0.0.1:55321";
const MAILPIT = Deno.env.get("MAILPIT_LOCAL_URL") ?? "http://127.0.0.1:55324";
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_LOCAL_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "dev-cron-secret";
const FAKE_PORT = 55999;
// O contentor da função chega ao anfitrião por host.docker.internal.
const FAKE_BASE = `http://host.docker.internal:${FAKE_PORT}`;

const H = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  "Content-Type": "application/json",
};

async function rest(
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...H, Prefer: "return=representation", ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function createUser(email: string, name: string): Promise<string> {
  const u = await rest("POST", "/auth/v1/admin/users", {
    email,
    email_confirm: true,
  });
  await rest("PATCH", `/rest/v1/profiles?id=eq.${u.id}`, { name });
  return u.id;
}

async function newSubscription(userId: string, endpoint: string) {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const p256dh = b64urlEncode(
    new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)),
  );
  const auth = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
  await rest("POST", "/rest/v1/push_subscriptions", {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
  });
}

function callFunction(secret: string | null) {
  return fetch(`${API}/functions/v1/send-reminders`, {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

async function mailTo(
  email: string,
): Promise<{ Subject: string; ID: string }[]> {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const body = await res.json();
    if (body.messages?.length) return body.messages;
    await new Promise((r) => setTimeout(r, 300));
  }
  return [];
}

Deno.test(
  "send-reminders: email, push (fake), idempotência, 410 e anti-spam",
  async () => {
    const received: {
      path: string;
      auth: string | null;
      encoding: string | null;
      size: number;
    }[] = [];
    const server = Deno.serve(
      { port: FAKE_PORT, hostname: "0.0.0.0", onListen() {} },
      async (req) => {
        const path = new URL(req.url).pathname;
        const body = await req.arrayBuffer();
        received.push({
          path,
          auth: req.headers.get("authorization"),
          encoding: req.headers.get("content-encoding"),
          size: body.byteLength,
        });
        return new Response("", {
          status: path.startsWith("/gone") ? 410 : 201,
        });
      },
    );

    const run = crypto.randomUUID().slice(0, 8);
    const petName = `Nina-${run}`;
    const emailA = `fn-a-${run}@example.test`;
    const emailB = `fn-b-${run}@example.test`;
    const emailC = `fn-c-${run}@example.test`;
    const emailD = `fn-d-${run}@example.test`;
    try {
      const a = await createUser(emailA, "Pedro");
      const b = await createUser(emailB, "Mãe");
      const c = await createUser(emailC, "Pai");
      // D tem as notificações ligadas, mas desligou os «Emails de lembrete» no Perfil.
      const d = await createUser(emailD, "Tia");
      await rest("PATCH", `/rest/v1/profiles?id=eq.${d}`, {
        reminder_emails: false,
      });
      const [pet] = await rest("POST", "/rest/v1/pets", {
        name: petName,
        species: "dog",
        created_by: a,
      });
      // O trigger faz do criador o dono; B é cuidador com notificações, C desligou-as.
      await rest(
        "POST",
        "/rest/v1/pet_members?on_conflict=pet_id,user_id",
        [
          { pet_id: pet.id, user_id: a, role: "owner", notify: true },
          { pet_id: pet.id, user_id: b, role: "caregiver", notify: true },
          { pet_id: pet.id, user_id: c, role: "caregiver", notify: false },
          { pet_id: pet.id, user_id: d, role: "caregiver", notify: true },
        ],
        { Prefer: "resolution=merge-duplicates,return=representation" },
      );

      await newSubscription(a, `${FAKE_BASE}/ok/${run}`);
      await newSubscription(b, `${FAKE_BASE}/gone/${run}`); // morta: tem de ser apagada
      await newSubscription(c, `${FAKE_BASE}/ok-c/${run}`); // notify desligado: não recebe

      const due = new Date(Date.now() - 3600_000).toISOString();
      const [manual] = await rest("POST", "/rest/v1/reminders", {
        pet_id: pet.id,
        title: "Desparasitação <b>externa</b>",
        due_at: due,
        channels: ["push", "email"],
      });
      const [med] = await rest("POST", "/rest/v1/reminders", {
        pet_id: pet.id,
        title: "Antibiótico",
        due_at: due,
        channels: ["push", "email"],
        source_type: "medication",
        source_id: crypto.randomUUID(),
      });
      const occ = await rest(
        "GET",
        `/rest/v1/reminder_occurrences?reminder_id=in.(${manual.id},${med.id})&select=id,reminder_id`,
      );
      assertEquals(occ.length, 2);
      const manualOcc = occ.find(
        (o: { reminder_id: string }) => o.reminder_id === manual.id,
      ).id;

      // Sem segredo: recusa
      assertEquals((await callFunction(null)).status, 401);
      assertEquals((await callFunction("errado")).status, 401);

      const res = await callFunction(CRON_SECRET);
      const out = await res.json();
      assertEquals(res.status, 200, JSON.stringify(out));

      // Email: A e B (notify) recebem o lembrete manual; C (notify desligado) não; ninguém recebe o da medicação
      const mailsA = await mailTo(emailA);
      const mailsB = await mailTo(emailB);
      assertEquals(
        mailsA.length,
        1,
        "A recebe 1 email (medicação não vai por email)",
      );
      assertEquals(mailsB.length, 1);
      assertEquals(
        mailsA[0]!.Subject,
        `${petName} · Desparasitação <b>externa</b>`,
      );
      const full = await (
        await fetch(`${MAILPIT}/api/v1/message/${mailsA[0]!.ID}`)
      ).json();
      assert(
        full.HTML.includes(`/?ocorrencia=${manualOcc}`),
        "link para a ocorrência",
      );
      assert(
        full.HTML.includes(`/animais/${pet.id}/lembretes`),
        "link das preferências",
      );
      assert(
        full.HTML.includes("Desparasitação &lt;b&gt;externa&lt;/b&gt;"),
        "título escapado",
      );
      assert(!full.HTML.includes("<b>externa</b>"));
      assertEquals(
        (await mailTo(emailC)).length,
        0,
        "notify desligado não recebe",
      );
      assertEquals(
        (await mailTo(emailD)).length,
        0,
        "emails de lembrete desligados no Perfil não recebe",
      );

      // Push: A (201) recebeu 2 (manual + medicação), B (410) foi apagada, C não recebeu
      const toA = received.filter((r) => r.path === `/ok/${run}`);
      assertEquals(toA.length, 2, "A recebe push do manual e da medicação");
      assert(
        toA.every(
          (r) =>
            r.auth?.startsWith("vapid t=") &&
            r.encoding === "aes128gcm" &&
            r.size > 100,
        ),
      );
      assertEquals(received.filter((r) => r.path === `/ok-c/${run}`).length, 0);
      const left = await rest(
        "GET",
        `/rest/v1/push_subscriptions?user_id=eq.${b}&select=id`,
      );
      assertEquals(left.length, 0, "subscrição 410 apagada");
      const usedA = await rest(
        "GET",
        `/rest/v1/push_subscriptions?user_id=eq.${a}&select=last_used_at`,
      );
      assert(usedA[0].last_used_at, "last_used_at atualizado");

      // Marcas na BD
      const marks = await rest(
        "GET",
        `/rest/v1/reminder_occurrences?reminder_id=in.(${manual.id},${med.id})&select=reminder_id,push_sent_at,email_sent_at`,
      );
      const m = (id: string) =>
        marks.find((x: { reminder_id: string }) => x.reminder_id === id);
      assert(m(manual.id).push_sent_at && m(manual.id).email_sent_at);
      assert(
        m(med.id).push_sent_at && m(med.id).email_sent_at === null,
        "medicação: sem email",
      );

      // Idempotência: segunda chamada não repete nada
      const pushesBefore = received.length;
      await callFunction(CRON_SECRET);
      assertEquals(received.length, pushesBefore, "sem push duplicado");
      assertEquals((await mailTo(emailA)).length, 1, "sem email duplicado");
    } finally {
      await server.shutdown();
    }
  },
);

const ANON =
  Deno.env.get("SUPABASE_LOCAL_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

Deno.test(
  "send-reminders: notificação de teste só vai para as subscrições de quem pede",
  async () => {
    const received: string[] = [];
    const server = Deno.serve(
      { port: FAKE_PORT, hostname: "0.0.0.0", onListen() {} },
      async (req) => {
        await req.arrayBuffer();
        received.push(new URL(req.url).pathname);
        return new Response("", { status: 201 });
      },
    );
    const run = crypto.randomUUID().slice(0, 8);
    const email = `fn-test-${run}@example.test`;
    try {
      const mine = await rest("POST", "/auth/v1/admin/users", {
        email,
        password: "palavra-passe-teste-1",
        email_confirm: true,
      });
      const other = await createUser(`fn-other-${run}@example.test`, "Outro");
      await newSubscription(mine.id, `${FAKE_BASE}/mine/${run}`);
      await newSubscription(other, `${FAKE_BASE}/other/${run}`);

      const token = await (
        await fetch(`${API}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: "palavra-passe-teste-1" }),
        })
      ).json();
      assert(token.access_token, "login de teste");

      const call = (bearer: string) =>
        fetch(`${API}/functions/v1/send-reminders`, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}` },
        });

      const res = await call(token.access_token);
      const body = await res.json();
      assertEquals(res.status, 200, JSON.stringify(body));
      assertEquals(body.sent, 1);
      assertEquals(
        received,
        [`/mine/${run}`],
        "só a subscrição do próprio utilizador",
      );

      // Segunda notificação no mesmo minuto: limite (429), sem enviar nada
      const again = await call(token.access_token);
      assertEquals(again.status, 429);
      assertEquals((await again.json()).error, "rate_limited");
      assertEquals(received.length, 1, "a recusada não envia push");

      // Chaves que não são de utilizador (anon, service role) não servem
      assertEquals((await call(ANON)).status, 401);
      assertEquals((await call(SERVICE_ROLE)).status, 401);
    } finally {
      await server.shutdown();
    }
  },
);
