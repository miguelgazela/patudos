import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";
import { writeFileSync } from "node:fs";
import { chooseNewClinic } from "./clinica";
import { PDFParse } from "pdf-parse";

import { formatISODate, todayISO } from "../src/lib/dates";
import { suggestNextDue } from "../src/lib/vet-visits/next-due";

import { insertRow, rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `ficha-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

async function createPet(page: Page, name: string, species: "Cão" | "Gato") {
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill(name);
  await page.getByText(species, { exact: true }).click();
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

/** Consulta completa (vacina, medicação, peso, custo) pelo caminho mais curto. */
async function registerFullVisit(page: Page) {
  await gotoApp(page, "/");
  await page.getByRole("button", { name: "Registar" }).click();
  await page.getByRole("link", { name: /^Consulta\./ }).click();
  await page.getByRole("button", { name: "Vacinação", exact: true }).click();
  await chooseNewClinic(page, "Dra. Inês");
  await page.getByRole("button", { name: "+ Vacina" }).click();
  await page
    .getByRole("dialog", { name: "Vacina ou desparasitação" })
    .getByRole("button", { name: "Adicionar" })
    .click();
  await page.getByRole("button", { name: "+ Medicação" }).click();
  const med = page.getByRole("dialog", { name: "Medicação" });
  await med.getByLabel("Medicamento").fill("Meloxicam");
  await med.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("button", { name: "+ Peso" }).click();
  await page.getByLabel("Peso", { exact: true }).fill("12,4");
  await page.getByLabel("Custo em euros").fill("45");
  await page.getByRole("button", { name: "Guardar consulta" }).click();
  await page
    .getByRole("dialog", { name: "Está tudo certo?" })
    .getByRole("button", { name: "Guardar consulta" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Consulta guardada" }),
  ).toBeVisible();
}

async function newPhone(browser: Browser) {
  const ctx = await browser.newContext({
    ...devices["iPhone 15"],
    baseURL: "http://localhost:3100",
  });
  return ctx.newPage();
}

async function pdfText(body: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(body) });
  const { text } = await parser.getText();
  await parser.destroy();
  return text;
}

test("ficha em PDF: ecrã 32, ficheiro com os dados certos, opções, cuidador e estranho", async ({
  page,
  browser,
}) => {
  const email = await signIn(page, "Rita");
  const petId = await createPet(page, "Nina", "Cão");
  await registerFullVisit(page);

  // Menu «⋯» → Ficha em PDF
  await gotoApp(page, `/animais/${petId}`);
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("link", { name: "Ficha em PDF" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/pdf$`));
  await expect(
    page.getByRole("heading", { name: "Ficha de Nina" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Partilhar" })).toBeEnabled({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("img", { name: /Pré-visualização/ }),
  ).toContainText("Antirrábica");
  await shot(page, "e32-pdf");

  // Alternar as opções muda o URL e a pré-visualização
  await page.getByRole("link", { name: "Só vacinas" }).click();
  await expect(page).toHaveURL(/incluir=vaccines/);
  await expect(
    page.getByRole("img", { name: /Pré-visualização/ }),
  ).not.toContainText("Meloxicam");
  await page.getByRole("link", { name: "Tudo", exact: true }).first().click();
  await expect(page).toHaveURL(/incluir=all/);

  // O ficheiro: application/pdf, com o texto esperado e sem dinheiro
  const url = `/animais/${petId}/pdf/ficha?incluir=all&periodo=all`;
  const t0 = Date.now();
  const res = await page.request.get(url);
  const ms = Date.now() - t0;
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["content-disposition"]).toContain(
    'filename="ficha-nina.pdf"',
  );
  const pdf = await res.body();
  if (process.env.SHOTS_DIR) {
    writeFileSync(`${process.env.SHOTS_DIR}/ficha-nina.pdf`, pdf);
  }
  console.log(`PDF: ${(pdf.length / 1024).toFixed(0)} kB em ${ms} ms`);
  expect(pdf.length).toBeGreaterThan(1000);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  const text = await pdfText(pdf);
  const nextYear = formatISODate(suggestNextDue(todayISO(), 12));
  expect(text).toContain("Nina");
  expect(text).toContain("Antirrábica");
  expect(text).toContain(formatISODate(todayISO()));
  expect(text).toContain(nextYear);
  expect(text).toContain("Meloxicam");
  expect(text).toContain("12,4 kg");
  expect(text).toContain("Dra. Inês");
  expect(text).toContain("Rita");
  expect(text).toContain(`Gerado pelo Patudos em ${formatISODate(todayISO())}`);
  expect(text).toMatch(/Página 1 de \d+/);
  expect(text).not.toContain("45,00");
  expect(text).not.toContain("€");

  // Só vacinas: sem medicação, peso nem consultas
  const only = await page.request.get(
    `/animais/${petId}/pdf/ficha?incluir=vaccines&periodo=year`,
  );
  expect(only.status()).toBe(200);
  const onlyText = await pdfText(await only.body());
  expect(onlyText).toContain("Antirrábica");
  expect(onlyText).not.toContain("Meloxicam");
  expect(onlyText).not.toContain("12,4 kg");

  // Cuidador: vê e gera
  const carer = await newPhone(browser);
  const carerEmail = await signIn(carer, "Zé");
  const [profile] = await rows<{ id: string }>(
    "profiles",
    `email=eq.${encodeURIComponent(carerEmail)}&select=id`,
  );
  await insertRow("pet_members", {
    pet_id: petId,
    user_id: profile!.id,
    role: "caregiver",
  });
  const carerRes = await carer.request.get(url);
  expect(carerRes.status()).toBe(200);
  expect(await pdfText(await carerRes.body())).toContain("Zé");
  await gotoApp(carer, `/animais/${petId}/pdf`);
  await expect(
    carer.getByRole("heading", { name: "Ficha de Nina" }),
  ).toBeVisible();

  // Estranho: 404 no ficheiro e no ecrã
  const stranger = await newPhone(browser);
  await signIn(stranger, "Intruso");
  expect((await stranger.request.get(url)).status()).toBe(404);
  // O ecrã (404 em streaming: o estado HTTP é 200, mas sem conteúdo)
  await gotoApp(stranger, `/animais/${petId}/pdf`);
  await expect(
    stranger.getByRole("heading", { name: "Ficha de Nina" }),
  ).toHaveCount(0);
  await expect(stranger.getByRole("button", { name: "Partilhar" })).toHaveCount(
    0,
  );

  // Sem sessão: também 404 (nunca devolve dados)
  const anon = await (
    await browser.newContext({ baseURL: "http://localhost:3100" })
  ).request.get(url, {
    maxRedirects: 0,
  });
  expect([401, 404, 307, 302, 303]).toContain(anon.status());
  expect(email).toBeTruthy();
});
