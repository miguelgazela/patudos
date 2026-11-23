import AxeBuilder from "@axe-core/playwright";
import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

import { waitForHydratedForm } from "./hydrated";
import { latestCode, latestMail } from "./mailpit";

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function newPhone(browser: Browser) {
  const ctx = await browser.newContext({
    ...devices["iPhone 15"],
    baseURL: "http://localhost:3100",
  });
  return ctx.newPage();
}

async function gotoApp(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch {
    await page.goto(url);
  }
}

async function enterCode(page: Page, email: string) {
  const sentAt = Date.now() - 1000;
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(await latestCode(email, sentAt));
  await expect(page).toHaveURL(/\/bem-vindo$/);
}

async function signIn(page: Page, email: string, name: string) {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Continuar no browser" }).click();
  await page.getByLabel("O teu email").fill(email);
  await enterCode(page, email);
  await page.getByLabel("O teu nome").fill(name);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoSeriousViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const bad = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes[0]?.target.join(" ")})`);
  expect(bad, label).toEqual([]);
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("sem sessão, «/» mostra a apresentação e «Começar» leva a /entrar", async ({
  page,
}) => {
  await gotoApp(page, "/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /A vida dos teus patudos/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Instala no iPhone/ }),
  ).toBeVisible();
  // Imagens reais da app, com texto alternativo.
  await expect(page.getByRole("img", { name: /Ecrã Hoje/i })).toBeVisible();
  await shot(page, "apresentacao-390");

  const footer = page.getByRole("navigation", { name: "Informação legal" });
  await expect(footer.getByRole("link", { name: "Termos" })).toHaveAttribute(
    "href",
    "/termos",
  );
  await expect(
    footer.getByRole("link", { name: "Privacidade" }),
  ).toHaveAttribute("href", "/privacidade");

  await page.getByRole("link", { name: "Começar" }).first().click();
  await expect(page).toHaveURL(/\/entrar$/);
  // Aceitação implícita: só texto com ligações, sem caixa nem passo extra.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("a apresentação também fica bem em desktop", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    baseURL: "http://localhost:3100",
  });
  const page = await ctx.newPage();
  await gotoApp(page, "/sobre");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, "apresentacao-desktop");
  await ctx.close();
});

test("termos e privacidade abrem sem sessão, com os marcadores por confirmar", async ({
  page,
}) => {
  await gotoApp(page, "/termos");
  await expect(page).toHaveURL(/\/termos$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Termos de utilização" }),
  ).toBeVisible();
  await expect(
    page.getByText("[A CONFIRMAR: email de contacto]"),
  ).toBeVisible();
  await shot(page, "termos-390");

  await page
    .getByRole("link", { name: "Ler a Política de privacidade" })
    .click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de privacidade" }),
  ).toBeVisible();
  for (const name of ["Supabase", "Vercel", "Resend", "Apple e Google"]) {
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  }
  await shot(page, "privacidade-390");

  await gotoApp(page, "/entrar");
  await page.getByRole("button", { name: "Continuar no browser" }).click();
  await expect(page.getByText(/Ao continuar, aceitas os/)).toBeVisible();
  await page.getByRole("link", { name: "Política de privacidade" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
});

test("as rotas privadas continuam a redirecionar para /entrar", async ({
  page,
}) => {
  for (const path of [
    "/animais",
    "/perfil",
    "/despesas",
    "/registar/consulta",
  ]) {
    await gotoApp(page, path);
    await expect(page, path).toHaveURL(/\/entrar$/);
  }
});

test("axe: apresentação, termos e privacidade sem violações sérias", async ({
  page,
}) => {
  for (const path of ["/", "/termos", "/privacidade"]) {
    await gotoApp(page, path);
    await expectNoSeriousViolations(page, path);
  }
});

test("novo utilizador: entra, diz o nome, vê o estado vazio, cria o animal e recebe sugestões", async ({
  page,
}) => {
  const email = `novo-${unique()}@exemplo.pt`;
  await signIn(page, email, "Rita");

  // Com sessão, «/» é o Hoje (não a apresentação) e convida a adicionar o primeiro animal.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rita");
  await expect(
    page.getByRole("heading", { name: /A vida dos teus patudos/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Adiciona o teu primeiro patudo" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Adicionar animal" }).click();
  await expect(page).toHaveURL(/\/animais\/novo$/);
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill("Nina");
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();

  // Sugestões opcionais: vacinas, convidar, notificações.
  await expect(
    page.getByRole("heading", { name: "Nina já está no Patudos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Registar as últimas vacinas/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Convidar alguém para cuidar de Nina/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Ativar as notificações/ }).click();
  await expect(page).toHaveURL(/\/perfil\/notificacoes$/);

  // O Perfil leva aos termos e privacidade.
  await gotoApp(page, "/perfil");
  await page.getByRole("link", { name: "Termos e privacidade" }).click();
  await expect(page).toHaveURL(/\/termos$/);
  // Com sessão as páginas públicas também abrem.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Termos de utilização",
  );
});

test("o cuidador convidado vê logo o animal, sem o estado vazio de «adicionar animal»", async ({
  browser,
}) => {
  const owner = await newPhone(browser);
  const guest = await newPhone(browser);
  const ownerEmail = `dono-${unique()}@exemplo.pt`;
  const guestEmail = `convidada-${unique()}@exemplo.pt`;

  await signIn(owner, ownerEmail, "Pedro");
  await gotoApp(owner, "/animais/novo");
  await waitForHydratedForm(owner);
  await owner.getByLabel("Nome").fill("Nina");
  await owner.getByText("Cão", { exact: true }).click();
  await owner.getByRole("button", { name: "Guardar" }).click();
  await expect(owner).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  const petId = /\/animais\/([0-9a-f-]+)\/criado$/.exec(owner.url())![1]!;

  await gotoApp(owner, `/animais/${petId}/pessoas/convidar`);
  await waitForHydratedForm(owner);
  const sentAt = Date.now() - 1000;
  await owner.getByLabel("Email").fill(guestEmail);
  await owner.getByRole("button", { name: "Enviar convite" }).click();
  await expect(owner).toHaveURL(/\/pessoas\?convite=enviado$/);
  const mail = await latestMail(
    guestEmail,
    "convidou-te para cuidar de Nina",
    sentAt,
  );
  const link = /http:\/\/localhost:3100\/entrar\?email=[^\s"<]+/.exec(
    mail.Text,
  )![0];

  await guest.goto(link);
  await guest.getByRole("button", { name: "Continuar no browser" }).click();
  await enterCode(guest, guestEmail);
  await guest.getByLabel("O teu nome").fill("Ana");
  await guest.getByRole("button", { name: "Continuar" }).click();
  await expect(guest).toHaveURL(/\/$/);

  // O Hoje já mostra a Nina; nunca o convite a adicionar o primeiro animal.
  await expect(
    guest.getByRole("link", { name: "Nina", exact: true }),
  ).toBeVisible();
  await expect(
    guest.getByRole("heading", { name: "Adiciona o teu primeiro patudo" }),
  ).toHaveCount(0);
  await expect(
    guest.getByRole("link", { name: "Adicionar animal" }),
  ).toHaveCount(0);
});
