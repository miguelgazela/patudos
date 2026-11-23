// Gera as capturas da página de apresentação (public/apresentacao/*.webp e og.png).
// Precisa do Supabase local e de `next dev -p 3200` (ou BASE_URL). Cria um utilizador novo com
// dados de exemplo (Nina, Simba, Pimenta). Uso: node scripts/capturar-apresentacao.mjs
import { webkit, devices } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const API = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:55321";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const OUT = "public/apresentacao";

async function rest(table, body, method = "POST", query = "") {
  const res = await fetch(`${API}/rest/v1/${table}${query}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return method === "GET" ? res.json() : res.json().catch(() => null);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function code(email, since) {
  for (let i = 0; i < 60; i++) {
    const { messages = [] } = await (
      await fetch(
        `${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + email)}`,
      )
    ).json();
    const m = messages.find((x) => Date.parse(x.Created) >= since);
    if (m) {
      const msg = await (
        await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)
      ).json();
      const c = /\b(\d{6})\b/.exec(msg.Text)?.[1];
      if (c) return c;
    }
    await sleep(250);
  }
  throw new Error("sem código");
}

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 864e5);

await mkdir(OUT, { recursive: true });
const browser = await webkit.launch();
const ctx = await browser.newContext({
  ...devices["iPhone 15"],
  locale: "pt-PT",
  timezoneId: "Europe/Lisbon",
});
await ctx.addInitScript(() => {
  // Sem os avisos do Hoje (instalar, notificações) nas capturas.
  try {
    localStorage.setItem("patudos:install-hint-dismissed", "1");
    localStorage.setItem("patudos:push-prompt-dismissed", "1");
  } catch {}
});
const page = await ctx.newPage();

// 1. Entrar com um utilizador novo.
const email = `pedro.${Math.random().toString(36).slice(2, 6)}@exemplo.pt`;
await page.goto(`${BASE}/entrar`);
await page
  .getByRole("button", { name: "Continuar no browser" })
  .click()
  .catch(() => {});
await page.getByLabel("O teu email").fill(email);
const since = Date.now() - 1000;
await page.getByRole("button", { name: "Enviar código" }).click();
await page.waitForURL(/\/entrar\/codigo$/);
await page.getByLabel("Dígito 1 de 6").click();
await page.keyboard.type(await code(email, since));
await page.waitForURL(/\/bem-vindo$/);
await page.getByLabel("O teu nome").fill("Pedro");
await page.getByRole("button", { name: "Continuar" }).click();
await page.waitForURL(`${BASE}/`);

// 2. Dados de exemplo (service role).
const [{ id: userId }] = await rest(
  "profiles",
  null,
  "GET",
  `?email=eq.${encodeURIComponent(email)}&select=id`,
);
const pet = async (name, species, color, breed, birth) =>
  (
    await rest("pets", {
      name,
      species,
      color,
      breed,
      sex: name === "Simba" ? "male" : "female",
      birth_date: birth,
      neutered: true,
      created_by: userId,
    })
  )[0].id;
const nina = await pet(
  "Nina",
  "dog",
  "laranja",
  "Serra da Estrela",
  "2019-03-15",
);
const simba = await pet("Simba", "cat", "azul", "Europeu comum", "2021-06-01");
const pimenta = await pet(
  "Pimenta",
  "cat",
  "uva",
  "Europeu comum",
  "2022-09-10",
);

// Mãe cuida da Nina (se existir o utilizador do seed).
const mae = await rest(
  "profiles",
  null,
  "GET",
  "?email=eq.mae@example.com&select=id",
);
if (mae[0])
  await rest("pet_members", {
    pet_id: nina,
    user_id: mae[0].id,
    role: "caregiver",
    notify: true,
  });
await rest("pet_invites", null, "GET", "?limit=1").catch(() => {});

const visit = (
  await rest("vet_visits", {
    pet_id: nina,
    visited_on: iso(addDays(-3)),
    reason: "Consulta anual e vacina",
    vet_name: "Dra. Marta Ferreira",
    clinic: "Clínica Veterinária do Parque",
    notes: "Tudo bem. Peso estável, dentes limpos.",
    created_by: userId,
  })
)[0].id;
await rest("health_events", {
  pet_id: nina,
  type: "vaccine",
  title: "Vacina antirrábica",
  occurred_on: iso(addDays(-3)),
  next_due_on: iso(addDays(362)),
  vet_visit_id: visit,
  created_by: userId,
});
await rest("health_events", {
  pet_id: nina,
  type: "deworming_internal",
  title: "Desparasitação interna",
  product: "Drontal",
  occurred_on: iso(addDays(-3)),
  next_due_on: iso(addDays(87)),
  vet_visit_id: visit,
  created_by: userId,
});
await rest("medications", {
  pet_id: nina,
  name: "Condroitina",
  dose: "1 comprimido",
  schedule_rrule: "FREQ=DAILY",
  starts_on: iso(addDays(-3)),
  ends_on: iso(addDays(27)),
  vet_visit_id: visit,
  created_by: userId,
});
for (const [d, kg] of [
  [-3, 24.6],
  [-95, 24.9],
  [-190, 25.4],
  [-300, 25.1],
])
  await rest("weights", {
    pet_id: nina,
    measured_on: iso(addDays(d)),
    weight_kg: kg,
    created_by: userId,
  });
// A despesa e as divisões têm de entrar na mesma transação (restrição diferida): SQL direto no contentor.
const exp = async (cat, cents, desc, d, splits, extra = {}) => {
  const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
  const sql = `begin; with e as (insert into expenses (category, amount_cents, description, spent_on, paid_by, created_by, vet_visit_id) values (${q(cat)}, ${cents}, ${q(desc)}, ${q(iso(addDays(d)))}, ${q(userId)}, ${q(userId)}, ${q(extra.vet_visit_id)}) returning id) insert into expense_splits (expense_id, pet_id, amount_cents, created_by) select e.id, v.pet, v.cents, ${q(userId)} from e, (values ${splits.map(([p, c]) => `(${q(p)}::uuid, ${c})`).join(",")}) as v(pet, cents); commit;`;
  execFileSync("docker", [
    "exec",
    "supabase_db_Patudos",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
};
await exp("veterinary", 5200, "Consulta e vacina", -3, [[nina, 5200]], {
  vet_visit_id: visit,
});
await exp("food", 4590, "Ração", -6, [[nina, 4590]]);
await exp("food", 3200, "Ração dos gatos", -9, [
  [simba, 1600],
  [pimenta, 1600],
]);
await exp("hygiene", 1850, "Champô e escova", -14, [[nina, 1850]]);
await exp("insurance", 2490, "Seguro do Simba", -18, [[simba, 2490]]);
await exp("veterinary", 6800, "Análises da Pimenta", -24, [[pimenta, 6800]]);
await exp("medication", 1450, "Antipulgas", -28, [
  [simba, 725],
  [pimenta, 725],
]);
// Para o Hoje: uma em atraso, uma para hoje, uma próxima.
await rest("health_events", {
  pet_id: nina,
  type: "vaccine",
  title: "Vacina da tosse do canil",
  occurred_on: iso(addDays(-370)),
  next_due_on: iso(addDays(-5)),
  created_by: userId,
});
await rest("health_events", {
  pet_id: simba,
  type: "deworming_external",
  title: "Desparasitação externa",
  product: "Bravecto",
  occurred_on: iso(addDays(-90)),
  next_due_on: iso(addDays(0)),
  created_by: userId,
});
await rest("health_events", {
  pet_id: pimenta,
  type: "vaccine",
  title: "Vacina polivalente",
  occurred_on: iso(addDays(-358)),
  next_due_on: iso(addDays(7)),
  created_by: userId,
});
await sleep(500);

// 3. Capturas.
const shots = {};
async function shot(name, path, prep) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if (prep) await prep();
  const buf = await page.screenshot({ type: "png" });
  shots[name] = buf;
  await sharp(buf)
    .resize({ width: 520 })
    .webp({ quality: 80, effort: 6 })
    .toFile(`${OUT}/${name}.webp`);
  console.log(name, path);
}
await shot("hoje", "/");
await shot("consulta", `/animais/${nina}/consulta/${visit}`);
await shot("despesas", "/despesas");
await shot("ficha", `/animais/${nina}`);
await shot("pessoas", `/animais/${nina}/pessoas`);

// 4. Imagem Open Graph 1200×630: três ecrãs sobre Pinheiro.
const w = 300;
const tiles = await Promise.all(
  ["hoje", "ficha"].map(async (n) => {
    const t = await sharp(shots[n])
      .resize({ width: w, height: 503, fit: "cover", position: "top" })
      .png()
      .toBuffer();
    const mask = Buffer.from(
      `<svg width="${w}" height="503"><rect width="${w}" height="503" rx="26"/></svg>`,
    );
    return sharp(t)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  }),
);
const text = Buffer.from(
  `<svg width="520" height="630" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Helvetica,Arial,sans-serif;font-weight:800;fill:#fff}</style>
   <text x="0" y="280" font-size="76">Patudos</text><text x="0" y="350" font-size="34" style="font-weight:600">A vida dos teus patudos,</text><text x="0" y="395" font-size="34" style="font-weight:600">num só sítio.</text></svg>`,
);
await sharp({
  create: { width: 1200, height: 630, channels: 3, background: "#0B6B5F" },
})
  .composite([
    { input: text, left: 60, top: 0 },
    { input: tiles[0], left: 540, top: 40 },
    { input: tiles[1], left: 870, top: 90 },
  ])
  .png({ compressionLevel: 9, palette: true })
  .toFile(`${OUT}/og.png`);

await browser.close();
