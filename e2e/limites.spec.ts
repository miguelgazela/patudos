import { devices, expect, test } from "@playwright/test";

import { insertRow, rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test("ao atingir o limite diário de convites aparece uma mensagem clara", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ...devices["iPhone 15"],
    baseURL: "http://localhost:3100",
  });
  const page = await ctx.newPage();
  const email = `limite-${unique()}@exemplo.pt`;

  await page.goto("/entrar");
  await page.getByRole("button", { name: "Continuar no browser" }).click();
  await page.getByLabel("O teu email").fill(email);
  const sentAt = Date.now() - 1000;
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(await latestCode(email, sentAt));
  await expect(page).toHaveURL(/\/bem-vindo$/);
  await page.getByLabel("O teu nome").fill("Rita");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill("Nina");
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  const petId = /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;

  // Simula 20 convites já enviados hoje (service role, sem enviar 20 emails)
  const [profile] = await rows<{ id: string }>(
    "profiles",
    `email=eq.${encodeURIComponent(email)}&select=id`,
  );
  for (let i = 0; i < 20; i++) {
    await insertRow("rate_limit_events", {
      user_id: profile!.id,
      action: "invite",
    });
  }

  await page.goto(`/animais/${petId}/pessoas/convidar`);
  await waitForHydratedForm(page);
  await page.getByLabel("Email").fill(`amiga-${unique()}@exemplo.pt`);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(/máximo 20 por dia/)).toBeVisible();
  await expect(page).toHaveURL(/\/pessoas\/convidar$/);
});

test("/api/saude responde 200 sem expor dados", async ({ request }) => {
  const res = await request.get("http://localhost:3100/api/saude");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(res.headers()["cache-control"]).toContain("no-store");
});
