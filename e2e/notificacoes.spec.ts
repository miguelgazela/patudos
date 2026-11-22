import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

import { todayISO } from "../src/lib/dates";
import { addDaysISO } from "../src/lib/vet-visits/next-due";

import { insertRow, rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

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

async function signIn(page: Page, name: string) {
  const email = `notif-${unique()}@exemplo.pt`;
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

async function createPet(page: Page, name: string) {
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill(name);
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  return /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;
}

/** Tratamento antigo (há 400 dias): a próxima data sugerida (+12 meses) já passou → em atraso. */
async function registerOverdueTreatment(page: Page) {
  await gotoApp(page, "/registar/tratamento");
  await page.getByLabel(/^Data/).fill(addDaysISO(todayISO(), -400));
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("treatment-saved")).toBeVisible();
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("Perfil → Notificações: no iPhone, fora da app instalada, explica como instalar", async ({
  page,
}) => {
  await signIn(page, "Pedro");
  await gotoApp(page, "/perfil");
  await page.getByRole("link", { name: /Notificações/ }).click();
  await expect(page).toHaveURL(/\/perfil\/notificacoes$/);
  const install = page.getByTestId("notificacoes-install");
  await expect(install).toBeVisible();
  await expect(install).toContainText("Adicionar ao ecrã principal");
  await expect(install).toContainText("iOS 16.4");
  await shot(page, "n1-instalar");
});

test("Notificações: estado «não suportado» e estado «recusadas» (app instalada)", async ({
  browser,
}) => {
  const page = await newPhone(browser);
  await signIn(page, "Pedro");
  // Simula a app instalada no ecrã principal, sem API de push
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    // @ts-expect-error simula um dispositivo sem PushManager
    delete window.PushManager;
  });
  await gotoApp(page, "/perfil/notificacoes");
  await expect(page.getByTestId("notificacoes-unsupported")).toBeVisible();
  await shot(page, "n2-nao-suportado");

  // Com push disponível mas permissão recusada
  const denied = await newPhone(browser);
  await signIn(denied, "Mãe");
  await denied.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    if (!("PushManager" in window)) {
      Object.defineProperty(window, "PushManager", { value: class {} });
    }
    if (!("Notification" in window)) {
      Object.defineProperty(window, "Notification", { value: class {} });
    }
    Object.defineProperty(Notification, "permission", {
      get: () => "denied",
      configurable: true,
    });
  });
  await gotoApp(denied, "/perfil/notificacoes");
  const panel = denied.getByTestId("notificacoes-denied");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("As notificações estão desligadas");
  await expect(panel).toContainText("Definições");
  await shot(denied, "n3-recusadas");
});

test("Notificações: com app instalada e permissão por pedir, mostra «Ativar notificações»", async ({
  browser,
}) => {
  const page = await newPhone(browser);
  await signIn(page, "Pedro");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
    if (!("PushManager" in window)) {
      Object.defineProperty(window, "PushManager", { value: class {} });
    }
    if (!("Notification" in window)) {
      Object.defineProperty(window, "Notification", { value: class {} });
    }
    Object.defineProperty(Notification, "permission", {
      get: () => "default",
      configurable: true,
    });
  });
  await gotoApp(page, "/perfil/notificacoes");
  await expect(page.getByTestId("notificacoes-off")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ativar notificações" }),
  ).toBeVisible();
  await shot(page, "n4-ativar");
});

test("Hoje: sugere ativar notificações quando há lembretes, e dá para dispensar", async ({
  page,
}) => {
  await signIn(page, "Pedro");
  await createPet(page, "Nina");
  await registerOverdueTreatment(page);
  await gotoApp(page, "/");
  const prompt = page.getByTestId("push-prompt");
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole("link")).toHaveAttribute(
    "href",
    "/perfil/notificacoes",
  );
  await shot(page, "n5-hoje-sugestao");
  await prompt.getByRole("button", { name: "Agora não" }).click();
  await expect(prompt).toHaveCount(0);
  await gotoApp(page, "/");
  await expect(page.getByTestId("hoje-item")).toBeVisible();
  await expect(page.getByTestId("push-prompt")).toHaveCount(0);
});

test("/?ocorrencia=<id> abre logo a confirmação «Feito» (tratamento)", async ({
  page,
}) => {
  await signIn(page, "Pedro");
  const petId = await createPet(page, "Nina");
  await registerOverdueTreatment(page);
  const [occ] = await rows<{ id: string }>(
    "reminder_occurrences",
    `pet_id=eq.${petId}&select=id`,
  );

  await gotoApp(page, `/?ocorrencia=${occ!.id}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Próxima")).not.toHaveValue("");
  await shot(page, "n6-ocorrencia-tratamento");
  await dialog.getByRole("button", { name: "Marcar como feito" }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => {
      const [o] = await rows<{ done_at: string | null }>(
        "reminder_occurrences",
        `id=eq.${occ!.id}&select=done_at`,
      );
      return o?.done_at ?? null;
    })
    .not.toBeNull();
  await expect(page).toHaveURL(/\/$/);
});

test("/?ocorrencia=<id> num lembrete simples pede só «Marcar como feito?»", async ({
  page,
}) => {
  await signIn(page, "Pedro");
  const petId = await createPet(page, "Nina");
  await insertRow("reminders", {
    pet_id: petId,
    title: "Escovar os dentes",
    due_at: new Date(Date.now() - 3_600_000).toISOString(),
    channels: ["push", "email"],
  });
  const [occ] = await rows<{ id: string }>(
    "reminder_occurrences",
    `pet_id=eq.${petId}&select=id`,
  );

  await gotoApp(page, `/?ocorrencia=${occ!.id}`);
  const dialog = page.getByRole("dialog", { name: "Marcar como feito?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Escovar os dentes");
  await shot(page, "n7-ocorrencia-simples");
  await dialog.getByRole("button", { name: "Marcar como feito" }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => {
      const [o] = await rows<{ done_at: string | null }>(
        "reminder_occurrences",
        `id=eq.${occ!.id}&select=done_at`,
      );
      return o?.done_at ?? null;
    })
    .not.toBeNull();
});

test("/?ocorrencia= com um id desconhecido não abre nada", async ({ page }) => {
  await signIn(page, "Pedro");
  await createPet(page, "Nina");
  await gotoApp(page, "/?ocorrencia=00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
