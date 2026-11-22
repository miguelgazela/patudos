import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

import { todayISO } from "../src/lib/dates";
import { addDaysISO } from "../src/lib/vet-visits/next-due";

import { rows } from "./db";
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
  const email = `lembretes-${unique()}@exemplo.pt`;
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

/** Espera que o React tenha ligado os botões da lista (senão o toque não faz nada). */
async function waitForHojeHydrated(page: Page) {
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid="hoje-item"] button');
    return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps$"));
  });
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("tratamento com próxima data e «Lembrar-me» aparece no Hoje e nos Lembretes; «Feito» regista e sugere a próxima", async ({
  page,
}) => {
  await signIn(page, "Pedro");
  const petId = await createPet(page, "Nina");
  await registerOverdueTreatment(page);

  const [event] = await rows<{ id: string; title: string; type: string }>(
    "health_events",
    `pet_id=eq.${petId}&select=id,title,type`,
  );
  const [reminder] = await rows<{ id: string; ended_at: string | null }>(
    "reminders",
    `pet_id=eq.${petId}&source_id=eq.${event!.id}&select=id,ended_at`,
  );
  expect(reminder).toBeTruthy();
  expect(reminder!.ended_at).toBeNull();

  // Hoje: em atraso, com o nome do animal
  await gotoApp(page, "/");
  await expect(page.getByRole("heading", { name: /Em atraso/ })).toBeVisible();
  const item = page.getByTestId("hoje-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Nina");
  await expect(item).toContainText(event!.title);
  await expect(item).toContainText(/há \d+ dias/);
  await shot(page, "h1-hoje-atraso");

  // Lembretes do animal (menu «⋯»)
  await gotoApp(page, `/animais/${petId}`);
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("link", { name: "Lembretes" }).click();
  await expect(page).toHaveURL(/\/lembretes$/);
  const list = page.getByTestId("lista-lembretes");
  await expect(list).toContainText(event!.title);
  await expect(list).toContainText(/da (vacina|desparasitação) de/);
  await shot(page, "l1-lembretes");

  // «Feito» no Hoje: abre a confirmação com a próxima data sugerida
  await gotoApp(page, "/");
  await waitForHojeHydrated(page);
  await item.getByRole("button", { name: "Marcar como feito" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const next = dialog.getByLabel("Próxima");
  await expect(next).not.toHaveValue("");
  const suggested = await next.inputValue();
  expect(suggested > todayISO()).toBe(true);
  await shot(page, "h2-confirmar-feito");
  await dialog.getByRole("button", { name: "Marcar como feito" }).click();
  await expect(dialog).toHaveCount(0);

  // Ficou registado hoje, com a próxima data, e o lembrete passou para a nova dose
  await expect
    .poll(
      async () =>
        (
          await rows<{ occurred_on: string; next_due_on: string | null }>(
            "health_events",
            `pet_id=eq.${petId}&title=eq.${encodeURIComponent(event!.title)}&select=occurred_on,next_due_on&order=occurred_on.desc`,
          )
        )[0],
    )
    .toMatchObject({ occurred_on: todayISO(), next_due_on: suggested });
  const active = await rows<{ id: string }>(
    "reminders",
    `pet_id=eq.${petId}&source_type=eq.health_event&ended_at=is.null&select=id`,
  );
  expect(active).toHaveLength(1);
  expect(active[0]!.id).not.toBe(reminder!.id);

  // Hoje: tudo em dia, com o «Feito por ti»
  await gotoApp(page, "/");
  await expect(page.getByText("Está tudo em dia")).toBeVisible();
  await expect(page.getByTestId("hoje-feito")).toContainText("Feito por ti");
  await expect(
    page.getByRole("link", { name: "Registar consulta" }),
  ).toBeVisible();
  await shot(page, "h3-tudo-em-dia");
});

test("o cuidador marca «Feito» e o dono vê «Feito por Mãe»", async ({
  browser,
}) => {
  const owner = await newPhone(browser);
  const mom = await newPhone(browser);
  const momEmail = await signIn(mom, "Mãe");
  await signIn(owner, "Pedro");
  const petId = await createPet(owner, "Nina");

  await gotoApp(owner, `/animais/${petId}/pessoas/convidar`);
  await waitForHydratedForm(owner);
  await owner.getByLabel("Email").fill(momEmail);
  await owner.getByRole("button", { name: "Enviar convite" }).click();
  await expect(owner).toHaveURL(/\/pessoas\?convite=enviado$/);

  await registerOverdueTreatment(owner);

  // A Mãe aceita o convite ao abrir «Animais» e vê o atraso no Hoje
  await gotoApp(mom, "/animais");
  await expect(mom.getByRole("link", { name: /Nina/ })).toBeVisible();
  await gotoApp(mom, "/");
  await expect(mom.getByTestId("hoje-item")).toContainText("Nina");
  await waitForHojeHydrated(mom);
  await mom
    .getByTestId("hoje-item")
    .getByRole("button", { name: "Marcar como feito" })
    .click();
  await mom
    .getByRole("dialog")
    .getByRole("button", { name: "Marcar como feito" })
    .click();
  await expect(mom.getByRole("dialog")).toHaveCount(0);

  const [occ] = await rows<{ done_by: string | null }>(
    "reminder_occurrences",
    `pet_id=eq.${petId}&done_at=not.is.null&select=done_by`,
  );
  expect(occ!.done_by).not.toBeNull();

  // O dono vê quem fez
  await gotoApp(owner, "/");
  await expect(owner.getByTestId("hoje-feito")).toContainText("Feito por Mãe");
  await expect(owner.getByTestId("hoje-item")).toHaveCount(0);
  await shot(owner, "h4-feito-por-mae");
});

test("lembrete manual: criar, marcar feito e desfazer, pausar e apagar", async ({
  page,
}) => {
  await signIn(page, "Rita");
  const petId = await createPet(page, "Mimi");

  await gotoApp(page, `/animais/${petId}/lembretes`);
  await expect(page.getByTestId("lista-lembretes")).toHaveCount(0);
  await page.getByRole("link", { name: "Novo lembrete" }).click();
  await expect(page).toHaveURL(/\/lembretes\/novo$/);
  await waitForHydratedForm(page);
  await page
    .getByRole("button", { name: "Comprar ração", exact: true })
    .click();
  // Hoje, a uma hora já passada, para aparecer logo no Hoje
  await page.getByLabel("Hora").fill("00:01");
  await page.getByRole("button", { name: "Todos os meses" }).click();
  await shot(page, "l2-novo");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/lembretes$/);
  const list = page.getByTestId("lista-lembretes");
  await expect(list).toContainText("Comprar ração");
  await expect(list).toContainText("Todos os meses");

  const [r] = await rows<{ id: string; rrule: string; created_by: string }>(
    "reminders",
    `pet_id=eq.${petId}&select=id,rrule,created_by`,
  );
  expect(r!.rrule).toBe("FREQ=MONTHLY");

  // Hoje: aparece e marca-se feito (sem confirmação), com «Desfazer»
  await gotoApp(page, "/");
  const item = page.getByTestId("hoje-item").first();
  await expect(item).toContainText("Comprar ração");
  await waitForHojeHydrated(page);
  await item.getByRole("button", { name: "Marcar como feito" }).click();
  await expect(page.getByTestId("hoje-feito")).toContainText("Feito por ti");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByTestId("hoje-feito")).toHaveCount(0);
  await expect(item).toContainText("Comprar ração");

  // Pausar: sai do Hoje e fica «Pausado» na lista
  await gotoApp(page, `/animais/${petId}/lembretes`);
  await page.getByRole("button", { name: /Comprar ração/ }).click();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(list).toContainText("Pausado");
  await gotoApp(page, "/");
  await expect(page.getByTestId("hoje-item")).toHaveCount(0);

  // Editar o título
  await gotoApp(page, `/animais/${petId}/lembretes`);
  await page.getByRole("button", { name: /Comprar ração/ }).click();
  await page.getByRole("link", { name: "Editar" }).click();
  await waitForHydratedForm(page);
  await page.getByLabel("O quê?").fill("Comprar areia");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/lembretes$/);
  await expect(page.getByTestId("lista-lembretes")).toContainText(
    "Comprar areia",
  );

  // Apagar
  await page.getByRole("button", { name: /Comprar areia/ }).click();
  await page.getByRole("button", { name: "Apagar" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Apagar" })
    .click();
  await expect(page.getByTestId("lista-lembretes")).toHaveCount(0);
  expect(await rows("reminders", `pet_id=eq.${petId}&select=id`)).toHaveLength(
    0,
  );
});
