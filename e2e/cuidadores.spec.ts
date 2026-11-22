import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

import { rows } from "./db";
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

/** Pede o código, escreve-o e (se for a primeira vez) escolhe o nome. */
async function signIn(page: Page, email: string, name: string) {
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

async function createPet(page: Page, name: string) {
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill(name);
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  return /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;
}

async function invite(page: Page, petId: string, email: string, role?: "Dono") {
  await gotoApp(page, `/animais/${petId}/pessoas/convidar`);
  await waitForHydratedForm(page);
  await page.getByLabel("Email").fill(email);
  if (role) await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page).toHaveURL(/\/pessoas\?convite=enviado$/);
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("o dono convida a Mãe, ela entra, regista uma consulta e o dono vê-a", async ({
  browser,
}) => {
  const owner = await newPhone(browser);
  const mom = await newPhone(browser);
  const ownerEmail = `dono-${unique()}@exemplo.pt`;
  const momEmail = `mae-${unique()}@exemplo.pt`;

  await signIn(owner, ownerEmail, "Pedro");
  const petId = await createPet(owner, "Nina");

  // Ecrã «Criado» → convidar
  await gotoApp(owner, `/animais/${petId}/criado`);
  await owner
    .getByRole("link", { name: /Convidar alguém para cuidar de Nina/ })
    .click();
  await expect(owner).toHaveURL(/\/pessoas\/convidar$/);
  await shot(owner, "p1-convidar");

  const sentAt = Date.now() - 1000;
  await waitForHydratedForm(owner);
  await owner.getByLabel("Email").fill(momEmail);
  await owner.getByRole("button", { name: "Enviar convite" }).click();
  await expect(owner).toHaveURL(/\/pessoas\?convite=enviado$/);
  await expect(owner.getByText("Convite enviado.")).toBeVisible();
  await expect(owner.getByText(momEmail)).toBeVisible();
  await shot(owner, "p2-pessoas-dono");

  // O email chega ao Mailpit: sem código nem link de login
  const mail = await latestMail(
    momEmail,
    "convidou-te para cuidar de Nina",
    sentAt,
  );
  expect(mail.Subject).toBe("Pedro convidou-te para cuidar de Nina");
  expect(mail.HTML).toContain("Abrir o Patudos");
  // (os números do email de teste vêm ligados por «-»: não contam)
  expect(mail.Text).not.toMatch(/(?<![\w-])\d{6}(?![\w-])/);
  const link = /http:\/\/localhost:3100\/entrar\?email=[^\s"<]+/.exec(
    mail.Text,
  )![0];
  expect(decodeURIComponent(link)).toContain(`email=${momEmail}`);

  // A Mãe abre o link (email pré-preenchido), entra com o código e vê só a Nina
  await mom.goto(link);
  await mom.getByRole("button", { name: "Continuar no browser" }).click();
  await expect(mom.getByLabel("O teu email")).toHaveValue(momEmail);
  const codeAt = Date.now() - 1000;
  await mom.getByRole("button", { name: "Enviar código" }).click();
  await expect(mom).toHaveURL(/\/entrar\/codigo$/);
  await mom.getByLabel("Dígito 1 de 6").click();
  await mom.keyboard.type(await latestCode(momEmail, codeAt));
  await expect(mom).toHaveURL(/\/bem-vindo$/);
  await mom.getByLabel("O teu nome").fill("Mãe");
  await mom.getByRole("button", { name: "Continuar" }).click();
  await expect(mom).toHaveURL(/\/$/);

  await gotoApp(mom, "/animais");
  await expect(mom.getByRole("link", { name: /Nina/ })).toContainText(
    "Cuidas com Pedro",
  );
  await expect(mom.getByRole("listitem")).toHaveCount(1);
  await shot(mom, "p3-lista-cuidador");

  // O convite deixou de estar pendente
  const [inv] = await rows<{ accepted_at: string | null }>(
    "pet_invites",
    `email=eq.${encodeURIComponent(momEmail)}&select=accepted_at`,
  );
  expect(inv!.accepted_at).not.toBeNull();

  // A Mãe regista uma consulta no telemóvel dela
  await gotoApp(mom, "/");
  await mom.getByRole("button", { name: "Registar" }).click();
  await mom.getByRole("link", { name: /^Consulta\./ }).click();
  await waitForHydratedForm(mom);
  await mom.getByRole("button", { name: "Vacinação", exact: true }).click();
  await mom.getByLabel("Veterinário / clínica").fill("Dra. Inês");
  await mom.getByRole("button", { name: "+ Peso" }).click();
  await mom.getByLabel("Peso", { exact: true }).fill("20,5");
  await mom.getByRole("button", { name: "Guardar consulta" }).click();
  await expect(
    mom.getByRole("heading", { name: "Consulta guardada" }),
  ).toBeVisible();

  // O dono vê-a no telemóvel dele, com «Registado por Mãe»
  await gotoApp(owner, `/animais/${petId}/cronologia`);
  const entry = owner.getByRole("link", { name: /Vacinação/ });
  await expect(entry).toContainText("Registado por Mãe");
  await shot(owner, "p4-cronologia-dono");

  // «Pago por» lista as duas pessoas (no registo do dono)
  await gotoApp(owner, "/registar/consulta");
  await owner.getByLabel("Custo em euros").fill("30");
  await expect(owner.getByRole("button", { name: "Mãe" })).toBeVisible();

  // Pessoas, do lado da Mãe: só leitura
  await gotoApp(mom, `/animais/${petId}/pessoas`);
  await expect(mom.getByText("Pedro")).toBeVisible();
  await expect(mom.getByText(momEmail)).toBeVisible();
  await expect(mom.getByRole("link", { name: "Convidar alguém" })).toHaveCount(
    0,
  );
  await expect(mom.getByRole("button", { name: /Opções para/ })).toHaveCount(0);
  await expect(
    mom.getByRole("button", { name: "Deixar de cuidar de Nina" }),
  ).toBeVisible();
  await shot(mom, "p5-pessoas-cuidador");

  // Não edita a ficha nem convida
  await gotoApp(mom, `/animais/${petId}/editar`);
  await expect(mom).not.toHaveURL(/editar/);
  await gotoApp(mom, `/animais/${petId}/pessoas/convidar`);
  await expect(mom).toHaveURL(/\/pessoas$/);

  // O dono remove a Mãe: ela deixa de ver a Nina
  await gotoApp(owner, `/animais/${petId}/pessoas`);
  await owner.getByRole("button", { name: "Opções para Mãe" }).click();
  await owner.getByRole("button", { name: "Remover de Nina" }).click();
  await shot(owner, "p6-remover");
  await owner
    .getByRole("alertdialog")
    .or(owner.getByRole("dialog", { name: /Remover Mãe/ }))
    .getByRole("button", { name: "Remover" })
    .click();
  await expect(owner.getByText("Mãe")).toHaveCount(0);

  await gotoApp(mom, "/animais");
  await expect(mom.getByRole("link", { name: /Nina/ })).toHaveCount(0);
  // A ficha já não abre (404 em streaming: o estado HTTP é 200, mas sem conteúdo)
  await mom.goto(`/animais/${petId}`);
  await expect(mom.getByRole("heading", { name: "Nina" })).toHaveCount(0);
  await expect(mom.getByRole("link", { name: /Vacinação/ })).toHaveCount(0);
});

test("o cuidador pode deixar de cuidar; o dono reenvia e cancela convites", async ({
  browser,
}) => {
  const owner = await newPhone(browser);
  const carer = await newPhone(browser);
  const ownerEmail = `dono-${unique()}@exemplo.pt`;
  const carerEmail = `pai-${unique()}@exemplo.pt`;
  const pendingEmail = `joana-${unique()}@exemplo.pt`;

  await signIn(owner, ownerEmail, "Pedro");
  const petId = await createPet(owner, "Pimenta");

  // Convite a um email que já tem conta: aceita ao abrir «Animais»
  await signIn(carer, carerEmail, "Pai");
  await invite(owner, petId, carerEmail);
  await gotoApp(carer, "/animais");
  await expect(carer.getByRole("link", { name: /Pimenta/ })).toBeVisible();

  // Convite duplicado reaproveita o pendente; reenviar manda outro email
  await invite(owner, petId, pendingEmail);
  await invite(owner, petId, pendingEmail.toUpperCase());
  await expect(owner.getByText(pendingEmail)).toHaveCount(1);
  const resentAt = Date.now() - 500;
  await owner.getByRole("button", { name: "Reenviar" }).click();
  await expect(
    owner.getByText(`Convite reenviado para ${pendingEmail}.`),
  ).toBeVisible();
  await latestMail(pendingEmail, "convidou-te", resentAt);

  // Quem já é membro não pode ser convidado outra vez
  await gotoApp(owner, `/animais/${petId}/pessoas/convidar`);
  await waitForHydratedForm(owner);
  await owner.getByLabel("Email").fill(carerEmail);
  await owner.getByRole("button", { name: "Enviar convite" }).click();
  await expect(
    owner.getByText("Essa pessoa já cuida deste animal."),
  ).toBeVisible();

  // Cancelar
  await gotoApp(owner, `/animais/${petId}/pessoas`);
  await owner.getByRole("button", { name: "Cancelar" }).click();
  await expect(owner.getByText(pendingEmail)).toHaveCount(0);

  // O interruptor de lembretes grava `notify`
  await gotoApp(carer, `/animais/${petId}/pessoas`);
  await waitForHydratedSwitch(carer);
  const sw = carer.getByRole("switch", {
    name: "Receber lembretes deste animal",
  });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect
    .poll(async () => {
      const [m] = await rows<{ notify: boolean }>(
        "pet_members",
        `pet_id=eq.${petId}&role=eq.caregiver&select=notify`,
      );
      return m?.notify;
    })
    .toBe(false);

  // Deixar de cuidar
  await carer
    .getByRole("button", { name: "Deixar de cuidar de Pimenta" })
    .click();
  await carer
    .getByRole("dialog", { name: "Deixar de cuidar de Pimenta?" })
    .getByRole("button", { name: "Deixar de cuidar" })
    .click();
  await expect(carer).toHaveURL(/\/animais$/);
  await expect(carer.getByRole("link", { name: /Pimenta/ })).toHaveCount(0);
});

async function waitForHydratedSwitch(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="switch"]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
  });
}
