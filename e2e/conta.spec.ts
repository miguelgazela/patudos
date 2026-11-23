import AxeBuilder from "@axe-core/playwright";
import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { readFileSync } from "node:fs";

import { insertRow, rows, storageObjectExists, uploadObject } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAdtgL+dZb8dAAAAABJRU5ErkJggg==",
  "base64",
);

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

async function signIn(page: Page, email: string, name: string) {
  await page.goto("/entrar");
  // A escolha «Continuar no browser» fica guardada: só aparece na primeira vez.
  await page
    .getByRole("button", { name: "Continuar no browser" })
    .click({ timeout: 4000 })
    .catch(() => {});
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

async function userId(email: string) {
  const [p] = await rows<{ id: string }>(
    "profiles",
    `email=eq.${encodeURIComponent(email)}&select=id`,
  );
  return p?.id;
}

/** Pedro (dono, com a Nina) e Mãe (cuidadora, com um peso registado por ela). */
async function setup(browser: Browser) {
  const ownerEmail = `dono-${unique()}@exemplo.pt`;
  const momEmail = `mae-${unique()}@exemplo.pt`;
  const owner = await newPhone(browser);
  const mom = await newPhone(browser);
  await signIn(owner, ownerEmail, "Pedro");
  await signIn(mom, momEmail, "Mãe");
  const petId = await createPet(owner, "Nina");
  const ownerId = (await userId(ownerEmail))!;
  const momId = (await userId(momEmail))!;
  await insertRow("pet_members", {
    pet_id: petId,
    user_id: momId,
    role: "caregiver",
  });
  await insertRow("weights", {
    pet_id: petId,
    weight_kg: 20.5,
    created_by: momId,
  });
  return { owner, mom, ownerEmail, momEmail, petId, ownerId, momId };
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function seriousViolations(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
}

test("exportar: descarrega um ZIP com dados.json, o animal e um documento", async ({
  page,
}) => {
  // Em iPhone a app usa a folha de partilha; aqui forçamos o descarregamento normal.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
  await signIn(page, `exp-${unique()}@exemplo.pt`, "Rita");
  const petId = await createPet(page, "Nina");
  const path = `${petId}/_fatura.png`;
  await uploadObject("documentos", path, PNG, "image/png");
  await insertRow("documents", {
    pet_id: petId,
    kind: "invoice",
    title: "Fatura da vacina",
    storage_path: path,
    mime_type: "image/png",
    document_date: "2026-11-02",
  });

  await gotoApp(page, "/perfil");
  await page.getByRole("link", { name: "Exportar os meus dados" }).click();
  await expect(page).toHaveURL(/\/perfil\/exportar$/);
  await shot(page, "e35-exportar");
  await page.getByRole("button", { name: "Preparar o ficheiro" }).click();
  await expect(page.getByText(/O ficheiro está pronto/)).toBeVisible();
  await shot(page, "e35-exportar-pronto");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar ficheiro" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^patudos-dados-\d{2}-\d{2}-\d{4}\.zip$/,
  );

  const zip = unzipSync(readFileSync((await file.path())!));
  const names = Object.keys(zip);
  expect(names).toEqual(
    expect.arrayContaining([
      "LEIA-ME.txt",
      "dados.json",
      "despesas.csv",
      "pesos.csv",
      "vacinas-e-desparasitacoes.csv",
    ]),
  );
  const doc = names.find((n) => n.startsWith("animais/Nina/documentos/"));
  expect(doc).toMatch(/2026-11-02 Fatura da vacina\.png$/);
  expect(Buffer.from(zip[doc!]!).equals(PNG)).toBe(true);

  const dados = JSON.parse(strFromU8(zip["dados.json"]!)) as {
    perfil: { nome: string };
    animais: { nome: string }[];
    documentos: { title: string }[];
  };
  expect(dados.perfil.nome).toBe("Rita");
  expect(dados.animais.map((a) => a.nome)).toEqual(["Nina"]);
  expect(dados.documentos[0]!.title).toBe("Fatura da vacina");
});

test("apagar conta sendo cuidador: o dono continua a ver o animal com «Conta apagada»", async ({
  browser,
}) => {
  const { owner, mom, momId, petId } = await setup(browser);

  await gotoApp(mom, "/perfil");
  await mom.getByRole("link", { name: "Apagar conta" }).click();
  await expect(mom).toHaveURL(/\/perfil\/apagar$/);
  await expect(
    mom.getByText("Só deixas de cuidar: Nina fica com Pedro"),
  ).toBeVisible();
  await shot(mom, "e35-apagar-cuidador");
  await mom.getByRole("button", { name: "Continuar" }).click();
  await expect(
    mom.getByRole("button", { name: "Apagar conta para sempre" }),
  ).toBeDisabled();
  await shot(mom, "e35-apagar-confirmar");
  await mom.getByLabel(/Para confirmar, escreve/).fill("apagar");
  await mom.getByRole("button", { name: "Apagar conta para sempre" }).click();

  await expect(mom).toHaveURL(/\/conta-apagada$/);
  await expect(
    mom.getByRole("heading", { name: "A tua conta foi apagada" }),
  ).toBeVisible();
  await shot(mom, "e35-conta-apagada");

  expect(await rows("profiles", `id=eq.${momId}&select=id`)).toHaveLength(0);
  expect(await rows("pets", `id=eq.${petId}&select=id`)).toHaveLength(1);
  const [w] = await rows<{ created_by: string | null }>(
    "weights",
    `pet_id=eq.${petId}&select=created_by`,
  );
  expect(w!.created_by).toBeNull();

  await gotoApp(owner, `/animais/${petId}/cronologia`);
  await expect(owner.getByText("Registado por Conta apagada")).toBeVisible();

  // Sem sessão: já não entra nas áreas privadas
  await gotoApp(mom, "/perfil");
  await expect(mom).toHaveURL(/\/entrar/);
});

test("apagar conta transferindo a posse: o animal fica com a nova dona", async ({
  browser,
}) => {
  const { owner, mom, ownerId, momId, petId } = await setup(browser);
  await uploadObject("documentos", `${petId}/_doc.png`, PNG, "image/png");

  await gotoApp(owner, "/perfil/apagar");
  await expect(owner.getByLabel("O que acontece a Nina")).toHaveValue(momId);
  await shot(owner, "e35-apagar-dono");
  await owner.getByRole("button", { name: "Continuar" }).click();
  await expect(owner.getByText("Nina passa para Mãe")).toBeVisible();
  await owner.getByLabel(/Para confirmar, escreve/).fill("APAGAR");
  await owner.getByRole("button", { name: "Apagar conta para sempre" }).click();
  await expect(owner).toHaveURL(/\/conta-apagada$/);

  expect(await rows("profiles", `id=eq.${ownerId}&select=id`)).toHaveLength(0);
  expect(await rows("pets", `id=eq.${petId}&select=id`)).toHaveLength(1);
  const members = await rows<{ user_id: string; role: string }>(
    "pet_members",
    `pet_id=eq.${petId}&select=user_id,role`,
  );
  expect(members).toEqual([{ user_id: momId, role: "owner" }]);
  expect(await storageObjectExists("documentos", `${petId}/_doc.png`)).toBe(
    true,
  );

  await gotoApp(mom, `/animais/${petId}/pessoas`);
  await expect(
    mom.getByRole("link", { name: "Convidar alguém" }),
  ).toBeVisible();
});

test("apagar conta sem transferir: o animal e os ficheiros desaparecem e o cuidador perde o acesso; entrar de novo cria uma conta vazia", async ({
  browser,
}) => {
  const { owner, mom, ownerEmail, ownerId, petId } = await setup(browser);
  const path = `${petId}/_doc.png`;
  await uploadObject("documentos", path, PNG, "image/png");
  await insertRow("documents", {
    pet_id: petId,
    kind: "other",
    title: "Documento",
    storage_path: path,
    mime_type: "image/png",
  });
  await gotoApp(mom, "/animais");
  await expect(mom.getByRole("link", { name: /Nina/ })).toBeVisible();

  await gotoApp(owner, "/perfil/apagar");
  await owner
    .getByLabel("O que acontece a Nina")
    .selectOption({ label: "Apagar Nina e o historial" });
  await expect(owner.getByText(/Mãe perde o acesso/)).toBeVisible();
  await owner.getByRole("button", { name: "Continuar" }).click();
  await expect(
    owner.getByText(/Nina é apagado com todo o historial; Mãe perde o acesso/),
  ).toBeVisible();
  await owner.getByLabel(/Para confirmar, escreve/).fill("APAGAR");
  await owner.getByRole("button", { name: "Apagar conta para sempre" }).click();
  await expect(owner).toHaveURL(/\/conta-apagada$/);

  expect(await rows("pets", `id=eq.${petId}&select=id`)).toHaveLength(0);
  expect(await rows("weights", `pet_id=eq.${petId}&select=id`)).toHaveLength(0);
  expect(await storageObjectExists("documentos", path)).toBe(false);

  await gotoApp(mom, "/animais");
  await expect(mom.getByRole("link", { name: /Nina/ })).toHaveCount(0);

  // Voltar a entrar com o mesmo email: conta nova (sem nome) e vazia
  await signIn(owner, ownerEmail, "Pedro");
  const newId = await userId(ownerEmail);
  expect(newId).toBeTruthy();
  expect(newId).not.toBe(ownerId);
  await gotoApp(owner, "/animais");
  await expect(owner.getByRole("link", { name: /Nina/ })).toHaveCount(0);
});

test("a confirmação exige escrever APAGAR", async ({ browser }) => {
  const { mom, momId } = await setup(browser);
  await gotoApp(mom, "/perfil/apagar");
  await mom.getByRole("button", { name: "Continuar" }).click();
  await mom.getByLabel(/Para confirmar, escreve/).fill("apagr");
  await expect(
    mom.getByRole("button", { name: "Apagar conta para sempre" }),
  ).toBeDisabled();
  expect(await rows("profiles", `id=eq.${momId}&select=id`)).toHaveLength(1);
});

test("acessibilidade (axe) do ecrã 35: exportar e apagar", async ({
  browser,
}) => {
  const { owner } = await setup(browser);
  await gotoApp(owner, "/perfil");
  expect(await seriousViolations(owner)).toEqual([]);
  await gotoApp(owner, "/perfil/exportar");
  expect(await seriousViolations(owner)).toEqual([]);
  await gotoApp(owner, "/perfil/apagar");
  expect(await seriousViolations(owner)).toEqual([]);
  await owner.getByRole("button", { name: "Continuar" }).click();
  await expect(owner.getByLabel(/Para confirmar, escreve/)).toBeVisible();
  expect(await seriousViolations(owner)).toEqual([]);
});
