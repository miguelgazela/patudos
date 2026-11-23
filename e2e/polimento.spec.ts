import { expect, test, type Page } from "@playwright/test";

import { rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `polimento-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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
  return email;
}

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
  await page.getByText("Gato", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  return /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;
}

test("Perfil: interruptores de emails de lembrete e de lembretes por animal gravam", async ({
  page,
}) => {
  const email = await signIn(page);
  const petId = await createPet(page, "Mimi");
  await gotoApp(page, "/perfil");

  const emails = page.getByRole("switch", { name: "Emails de lembrete" });
  const pet = page.getByRole("switch", { name: "Receber lembretes de Mimi" });
  await expect(emails).toHaveAttribute("aria-checked", "true");
  await expect(pet).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Animais arquivados")).toBeVisible();
  await expect(page.getByText(/Patudos · versão/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Terminar sessão" }),
  ).toBeVisible();

  await waitForHydratedSwitches(page);
  await emails.click();
  await expect(emails).toHaveAttribute("aria-checked", "false");
  await pet.click();
  await expect(pet).toHaveAttribute("aria-checked", "false");

  await expect
    .poll(async () => {
      const p = await rows<{ reminder_emails: boolean }>(
        "profiles",
        `email=eq.${encodeURIComponent(email)}&select=reminder_emails`,
      );
      const m = await rows<{ notify: boolean }>(
        "pet_members",
        `pet_id=eq.${petId}&select=notify`,
      );
      return [p[0]?.reminder_emails, m[0]?.notify];
    })
    .toEqual([false, false]);

  // Fica guardado ao voltar ao ecrã
  await gotoApp(page, "/perfil");
  await expect(
    page.getByRole("switch", { name: "Emails de lembrete" }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByRole("switch", { name: "Receber lembretes de Mimi" }),
  ).toHaveAttribute("aria-checked", "false");
});

async function waitForHydratedSwitches(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="switch"]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
  });
}

test("404 simpático: animal inexistente e endereço que não existe", async ({
  page,
}) => {
  await signIn(page);

  await gotoApp(page, "/animais/00000000-0000-0000-0000-000000000000");
  await expect(
    page.getByRole("heading", { level: 1, name: "Não encontrámos isto" }),
  ).toBeVisible();
  // A barra inferior mantém-se: dá para sair dali
  await expect(
    page.getByRole("navigation", { name: "Principal" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir para o Hoje" }).click();
  await expect(page).toHaveURL(/\/$/);

  await gotoApp(page, "/isto-nao-existe");
  await expect(
    page.getByRole("heading", { level: 1, name: "Não encontrámos isto" }),
  ).toBeVisible();
});

test("sem ligação: aviso visível e gravar falha com mensagem clara, sem perder o que escreveste", async ({
  page,
  context,
}) => {
  await signIn(page);
  await createPet(page, "Mimi");
  await gotoApp(page, "/registar/peso");
  await waitForHydratedForm(page);

  await page.getByLabel("Peso", { exact: true }).fill("4,35");
  await context.setOffline(true);
  await expect(page.getByRole("alert").first()).toContainText(
    "Sem ligação à internet",
  );
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText(/Sem ligação à internet\. Os dados continuam aqui/),
  ).toBeVisible();
  await expect(page.getByLabel("Peso", { exact: true })).toHaveValue("4,35");

  // Quando a ligação volta, o mesmo formulário grava
  await context.setOffline(false);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("weight-saved")).toBeVisible();
});

test("toast: «Nome guardado» aparece por cima da barra inferior", async ({
  page,
}) => {
  await signIn(page);
  await gotoApp(page, "/perfil");
  await waitForHydratedSwitches(page);
  await page.getByRole("button", { name: "Editar nome" }).click();
  await page.getByLabel("O teu nome").fill("Rita Maria");
  await page.getByRole("button", { name: "Guardar nome" }).click();
  const toast = page.getByTestId("toast");
  await expect(toast).toContainText("Nome guardado");
  const t = await toast.boundingBox();
  const nav = await page
    .getByRole("navigation", { name: "Principal" })
    .boundingBox();
  expect(t!.y + t!.height).toBeLessThanOrEqual(nav!.y);
});
