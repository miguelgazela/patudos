import { expect, test, type Page } from "@playwright/test";

import { insertRow } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function signIn(page: Page, name: string) {
  const email = `cal-${unique()}@exemplo.pt`;
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Continuar no browser" }).click();
  await page.getByLabel("O teu email").fill(email);
  const sentAt = Date.now() - 1000;
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(await latestCode(email, sentAt));
  await expect(page).toHaveURL(/\/bem-vindo$/);
  await page.getByLabel("O teu nome").fill(name);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** `goto` com uma segunda tentativa: logo a seguir ao início de sessão pode haver uma navegação ainda a terminar. */
async function gotoApp(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch {
    await page.goto(url);
  }
}

async function createPet(page: Page, name: string) {
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill(name);
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  return /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("Calendário: link gerado no 1.º acesso, feed .ics com o lembrete, e «Gerar novo link» invalida o antigo", async ({
  page,
  request,
}) => {
  await signIn(page, "Pedro");
  const petId = await createPet(page, "Nina");
  const title = `Banho ${unique()}`;
  await insertRow("reminders", {
    pet_id: petId,
    title,
    due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  });
  // Um lembrete sem o canal «calendar» não pode aparecer
  const hidden = `Só push ${unique()}`;
  await insertRow("reminders", {
    pet_id: petId,
    title: hidden,
    due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    channels: ["push"],
  });

  await page.goto("/perfil");
  await page.getByRole("link", { name: /Calendário/ }).click();
  await expect(page).toHaveURL(/\/perfil\/calendario$/);
  const panel = page.getByTestId("calendario-panel");
  await expect(panel).toBeVisible();
  const link = page.getByLabel("O teu link");
  const url1 = await link.inputValue();
  expect(url1).toMatch(/\/api\/calendario\/[A-Za-z0-9_-]{43}\.ics$/);
  await expect(page.getByTestId("calendario-webcal")).toHaveAttribute(
    "href",
    url1.replace(/^https?:/, "webcal:"),
  );
  await shot(page, "c1-calendario");

  // Voltar a abrir o ecrã mostra o mesmo link
  await page.reload();
  await expect(page.getByLabel("O teu link")).toHaveValue(url1);

  // O feed responde sem sessão
  const res = await request.get(url1);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  expect(res.headers()["cache-control"]).toContain("private");
  const body = await res.text();
  expect(body).toContain("BEGIN:VCALENDAR");
  expect(body).toContain(`SUMMARY:Nina · ${title}`);
  expect(body).not.toContain(hidden);

  // Token inválido → 404
  const bad = await request.get(
    url1.replace(/\/[^/]+$/, `/${"x".repeat(43)}.ics`),
  );
  expect(bad.status()).toBe(404);

  // Gerar novo link, com confirmação
  await page.getByRole("button", { name: "Gerar novo link" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("O link antigo deixa de funcionar");
  await shot(page, "c2-confirmar");
  await dialog.getByRole("button", { name: "Gerar novo link" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("O teu link")).not.toHaveValue(url1);
  const url2 = await page.getByLabel("O teu link").inputValue();

  expect((await request.get(url1)).status()).toBe(404);
  const fresh = await request.get(url2);
  expect(fresh.status()).toBe(200);
  expect(await fresh.text()).toContain(title);
});
