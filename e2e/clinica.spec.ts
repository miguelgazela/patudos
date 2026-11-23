import { expect, test, type Page } from "@playwright/test";
import { chooseNewClinic } from "./clinica";

import { rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `clinica-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

/** `goto` com uma segunda tentativa: logo a seguir ao início de sessão pode haver uma navegação ainda a terminar. */
async function gotoApp(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch {
    await page.goto(url);
  }
}

async function createPet(page: Page, name: string, species: "Cão" | "Gato") {
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill(name);
  await page.getByText(species, { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  return /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;
}

async function openConsulta(page: Page) {
  await gotoApp(page, "/");
  await page.getByRole("button", { name: "Registar" }).click();
  await page.getByRole("link", { name: /^Consulta\./ }).click();
  await expect(page).toHaveURL(/\/registar\/consulta$/);
  await expect(
    page.getByRole("heading", { name: "Registar consulta" }),
  ).toBeVisible();
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/clinica-${name}.png` });
}

async function saveSimpleVisit(page: Page) {
  await page.getByRole("button", { name: "Vacinação", exact: true }).click();
  await page.getByRole("button", { name: "Guardar consulta" }).click();
  await expect(
    page.getByRole("heading", { name: "Consulta guardada" }),
  ).toBeVisible();
}

test("a primeira clínica fica habitual, é partilhada entre animais e tem telefone e WhatsApp", async ({
  page,
}) => {
  await signIn(page);
  const nina = await createPet(page, "Nina", "Cão");
  const rex = await createPet(page, "Rex", "Cão");

  // Primeira consulta da Nina: clínica nova só com o nome
  await openConsulta(page);
  await gotoApp(page, `/registar/consulta?animal=${nina}`);
  await waitForHydratedForm(page);
  await expect(page.getByTestId("clinic-card")).toContainText("Escolher");
  await chooseNewClinic(page, "VetLumiar");
  await expect(page.getByTestId("clinic-card")).toContainText("VetLumiar");
  await shot(page, "1-cartao");
  await saveSimpleVisit(page);

  const [pet] = await rows<{ clinics: { name: string } | null }>(
    "pets",
    `id=eq.${nina}&select=clinics(name)`,
  );
  expect(pet!.clinics?.name).toBe("VetLumiar");

  // Segunda consulta: já vem escolhida; o Rex vê a clínica como opção
  await gotoApp(page, `/registar/consulta?animal=${nina}`);
  await expect(page.getByTestId("clinic-card")).toContainText("VetLumiar");
  await gotoApp(page, `/registar/consulta?animal=${rex}`);
  await page.getByTestId("clinic-card").click();
  const sheet = page.getByRole("dialog", { name: "Clínica" });
  await expect(sheet.getByRole("radio", { name: /VetLumiar/ })).toBeVisible();
  await shot(page, "2-painel");
  await sheet.getByRole("radio", { name: /VetLumiar/ }).click();
  await saveSimpleVisit(page);

  // Os dois animais apontam para a mesma clínica (sem duplicados)
  const habituais = await rows<{ clinic_id: string }>(
    "pets",
    `id=in.(${nina},${rex})&select=clinic_id`,
  );
  expect(new Set(habituais.map((h) => h.clinic_id)).size).toBe(1);

  // Ficha: habitual sem telefone, depois editar telefone e ver Ligar + WhatsApp
  await gotoApp(page, `/animais/${nina}`);
  await expect(page.getByTestId("habitual-clinic")).toContainText("VetLumiar");
  await page.getByRole("link", { name: "Alterar" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${nina}/clinica$`));
  await waitForHydratedForm(page);
  await page
    .getByLabel(/^Telefone/)
    .first()
    .fill("912 345 678");
  await page.getByLabel("Morada").fill("Rua A, Lisboa");
  await shot(page, "3-gerir");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${nina}$`));

  const card = page.getByTestId("habitual-clinic");
  await expect(card).toContainText("Rua A, Lisboa");
  await expect(card.getByRole("link", { name: /Ligar/ })).toHaveAttribute(
    "href",
    "tel:912345678",
  );
  await expect(card.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/351912345678",
  );
  await shot(page, "4-ficha");

  // O Rex partilha a mesma clínica (e o telefone)
  await gotoApp(page, `/animais/${rex}`);
  await expect(page.getByTestId("habitual-clinic")).toContainText("VetLumiar");
});
