import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

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
  await page.getByLabel("Veterinário / clínica").fill("Dra. Inês");
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

test("registar uma consulta completa e vê-la na ficha (resumo, cronologia, peso, detalhe)", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const petId = await createPet(page, "Bolacha", "Cão");

  const t0 = Date.now();
  await registerFullVisit(page);
  await page.getByRole("link", { name: "Ver na cronologia" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}$`));
  await expect(page.getByRole("link", { name: /Vacinação/ })).toBeVisible();
  const elapsed = Date.now() - t0;
  console.log(
    `REGISTAR CONSULTA COMPLETA → VER NA FICHA: ${(elapsed / 1000).toFixed(1)} s`,
  );
  testInfo.annotations.push({ type: "tempo", description: `${elapsed} ms` });

  // Resumo
  const nextYear = suggestNextDue(todayISO(), 12);
  await expect(page.getByRole("heading", { name: "Bolacha" })).toBeVisible();
  await expect(page.getByText("Cão", { exact: false }).first()).toBeVisible();
  const due = page.getByRole("link", { name: /Antirrábica/ });
  await expect(due).toContainText(formatISODate(nextYear));
  await expect(due).toContainText("Em 12 meses");
  await expect(page.getByRole("link", { name: /Meloxicam/ })).toContainText(
    "1× por dia · 08:00",
  );
  await expect(page.getByText("12,4 kg").first()).toBeVisible();
  await expect(page.getByText("Registada por ti")).toBeVisible();
  await shot(page, "f1-resumo");

  // Cronologia: a consulta traz tudo dentro, sem entradas duplicadas
  await page.getByRole("link", { name: "Cronologia", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/cronologia$`));
  const monthHeading = new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  await expect(
    page.getByRole("heading", { name: new RegExp(monthHeading, "i") }),
  ).toBeVisible();
  const entry = page.getByRole("link", { name: /Vacinação/ });
  await expect(entry).toContainText(
    "Dra. Inês · Antirrábica · Meloxicam · 12,4 kg · 45,00 €",
  );
  await expect(entry).toContainText("Registado por ti");
  // Nada de entradas soltas para o que está dentro da consulta
  await expect(page.getByRole("link", { name: /^Antirrábica/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Peso 12,4 kg/ })).toHaveCount(
    0,
  );
  await shot(page, "f2-cronologia");

  // Peso
  await page
    .getByRole("navigation", { name: "Secções da ficha" })
    .getByRole("link", { name: "Peso" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/peso$`));
  await expect(
    page.getByRole("img", { name: /Evolução do peso/ }),
  ).toBeVisible();
  await expect(page.getByText("Na consulta")).toBeVisible();
  await page.getByRole("link", { name: "6 meses" }).click();
  await expect(page).toHaveURL(/periodo=6m/);
  await expect(
    page.getByRole("img", { name: /Evolução do peso/ }),
  ).toBeVisible();
  await shot(page, "f3-peso");

  // Documentos: o anexo (fatura) aparece
  await page.getByRole("link", { name: "Documentos", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/documentos$`));
  await shot(page, "f4-documentos");

  // Detalhe da consulta
  await page.getByRole("link", { name: "Cronologia", exact: true }).click();
  await page.getByRole("link", { name: /Vacinação/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/animais/${petId}/consulta/[0-9a-f-]+$`),
  );
  await expect(page.getByRole("heading", { name: "Vacinação" })).toBeVisible();
  await expect(page.getByText("45,00 €", { exact: true })).toBeVisible();
  await expect(page.getByText("Pago por ti")).toBeVisible();
  await expect(page.getByRole("link", { name: /Meloxicam/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Peso 12,4 kg/ })).toBeVisible();
  await expect(page.getByText(/Registada por ti em/)).toBeVisible();
  await shot(page, "f5-consulta");

  // Detalhe de um registo (vacina) com ligação à consulta e próxima data
  await page.getByRole("link", { name: /Antirrábica/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`/animais/${petId}/registo/evento/[0-9a-f-]+$`),
  );
  await expect(
    page.getByRole("heading", { name: "Antirrábica" }),
  ).toBeVisible();
  await expect(
    page.getByText(`${formatISODate(nextYear)} · Em 12 meses`),
  ).toBeVisible();
  await expect(page.getByText("Registado na consulta")).toBeVisible();
  await shot(page, "f6-registo");

  // Apagar com confirmação: sai da consulta e das próximas datas
  await page.getByRole("button", { name: "Apagar", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: /Apagar Antirrábica/ });
  await shot(page, "f7-apagar");
  await confirm.getByRole("button", { name: "Apagar" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/cronologia$`));
  expect(
    await rows("health_events", `pet_id=eq.${petId}&select=id`),
  ).toHaveLength(0);
});

test("filtros da cronologia", async ({ page }) => {
  await signIn(page);
  const petId = await createPet(page, "Bolacha", "Cão");
  await registerFullVisit(page);

  // Peso em casa (entrada própria, fora de consulta)
  await gotoApp(page, `/registar/peso?animal=${petId}`);
  await page.getByLabel("Peso", { exact: true }).fill("12,8");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("weight-saved")).toBeVisible();

  await gotoApp(page, `/animais/${petId}/cronologia`);
  const chips = page.getByRole("navigation", { name: "Filtrar a cronologia" });
  const visit = page.getByRole("link", { name: /Vacinação/ });
  const home = page.getByRole("link", { name: /Peso 12,8 kg/ });
  await expect(visit).toBeVisible();
  await expect(home).toBeVisible();

  await chips.getByRole("link", { name: "Consultas", exact: true }).click();
  await expect(page).toHaveURL(/filtro=consultas/);
  await expect(visit).toBeVisible();
  await expect(home).toBeHidden();

  await chips.getByRole("link", { name: "Peso", exact: true }).click();
  await expect(visit).toBeVisible();
  await expect(home).toBeVisible();
  await shot(page, "f8-filtro-peso");

  await chips.getByRole("link", { name: "Vacinas", exact: true }).click();
  await expect(visit).toBeVisible();
  await expect(home).toBeHidden();

  await chips.getByRole("link", { name: "Desparasitações" }).click();
  await expect(page.getByText("Nada por aqui")).toBeVisible();
  await expect(page.getByText("Não há registos deste tipo.")).toBeVisible();
  await shot(page, "f9-filtro-vazio");

  await chips.getByRole("link", { name: "Tudo", exact: true }).click();
  await expect(visit).toBeVisible();
  await expect(home).toBeVisible();
});

test("medicação: terminar e apagar um peso; estados vazios", async ({
  page,
}) => {
  await signIn(page);
  const petId = await createPet(page, "Bolacha", "Cão");

  // Ficha nova: estados vazios simpáticos
  await gotoApp(page, `/animais/${petId}`);
  await expect(
    page.getByText("Sem datas à vista.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Sem medicação ativa.")).toBeVisible();
  await expect(page.getByText("Ainda não há pesagens.")).toBeVisible();
  await expect(page.getByText("Ainda sem consultas registadas.")).toBeVisible();
  await shot(page, "f10-resumo-vazio");
  await page
    .getByRole("navigation", { name: "Secções da ficha" })
    .getByRole("link", { name: "Peso" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ainda não há pesagens" }),
  ).toBeVisible();

  await registerFullVisit(page);
  await gotoApp(page, `/animais/${petId}`);
  await page.getByRole("link", { name: /Meloxicam/ }).click();
  await expect(page).toHaveURL(/\/registo\/medicacao\//);
  await expect(page.getByText("Sem data de fim")).toBeHidden();
  await page.getByRole("button", { name: "Terminar medicação" }).click();
  await page
    .getByRole("dialog", { name: "Terminar a medicação?" })
    .getByRole("button", { name: "Terminar" })
    .click();
  await expect(
    page.getByRole("button", { name: "Terminar medicação" }),
  ).toBeHidden();
  await expect(page.getByText(formatISODate(todayISO())).first()).toBeVisible();
  await expect
    .poll(async () => {
      const [med] = await rows<{ ends_on: string }>(
        "medications",
        `pet_id=eq.${petId}&select=ends_on`,
      );
      return med?.ends_on;
    })
    .toBe(todayISO());
});

test("cuidador: não vê Editar ficha nem Arquivar, e só apaga o que registou", async ({
  page,
  browser,
}) => {
  const ownerEmail = await signIn(page, "Rita");
  const petId = await createPet(page, "Bolacha", "Cão");
  await registerFullVisit(page);
  await gotoApp(page, `/animais/${petId}`);
  // O dono tem o menu com as duas ações
  await page.getByRole("button", { name: "Mais opções" }).click();
  await expect(page.getByRole("link", { name: "Editar ficha" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arquivar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pessoas/ })).toBeVisible();
  await shot(page, "f11-menu");
  expect(ownerEmail).toContain("@");

  const ctx = await newPhoneContext(browser);
  const caregiver = await ctx.newPage();
  const careEmail = await signIn(caregiver, "Mãe");
  const [profile] = await rows<{ id: string }>(
    "profiles",
    `email=eq.${encodeURIComponent(careEmail)}&select=id`,
  );
  await insertRow("pet_members", {
    pet_id: petId,
    user_id: profile!.id,
    role: "caregiver",
  });

  await gotoApp(caregiver, `/animais/${petId}`);
  await expect(
    caregiver.getByRole("heading", { name: "Bolacha" }),
  ).toBeVisible();
  await expect(
    caregiver.getByRole("link", { name: /Vacinação/ }),
  ).toContainText("Registada por Rita");
  // O cuidador tem o menu, mas só com «Pessoas» (leitura)
  await caregiver.getByRole("button", { name: "Mais opções" }).click();
  await expect(caregiver.getByRole("link", { name: /Pessoas/ })).toBeVisible();
  await expect(caregiver.getByText("Editar ficha")).toHaveCount(0);
  await expect(caregiver.getByText("Arquivar")).toHaveCount(0);
  await caregiver.keyboard.press("Escape");
  await shot(caregiver, "f12-cuidador");

  // A edição da ficha está fechada ao cuidador
  await gotoApp(caregiver, `/animais/${petId}/editar`);
  await expect(caregiver).not.toHaveURL(/editar/);

  // Consulta do dono: o cuidador vê-a mas não a edita nem apaga
  await gotoApp(caregiver, `/animais/${petId}/cronologia`);
  await caregiver.getByRole("link", { name: /Vacinação/ }).click();
  await expect(caregiver.getByText("45,00 €", { exact: true })).toBeVisible();
  await expect(caregiver.getByText("Registada por Rita em")).toBeVisible();
  await expect(
    caregiver.getByRole("link", { name: "Editar ou apagar" }),
  ).toHaveCount(0);
  await caregiver.getByRole("link", { name: /Peso 12,4 kg/ }).click();
  await expect(caregiver.getByRole("button", { name: "Apagar" })).toHaveCount(
    0,
  );

  // O seu próprio peso: pode apagar
  await gotoApp(caregiver, `/registar/peso?animal=${petId}`);
  await caregiver.getByLabel("Peso", { exact: true }).fill("12,9");
  await caregiver.getByRole("button", { name: "Guardar" }).click();
  await expect(caregiver.getByTestId("weight-saved")).toBeVisible();
  await gotoApp(caregiver, `/animais/${petId}/peso`);
  await caregiver.getByRole("link", { name: /12,9 kg/ }).click();
  await expect(caregiver.getByText("Registado por ti em")).toBeVisible();
  await caregiver.getByRole("button", { name: "Apagar", exact: true }).click();
  await caregiver
    .getByRole("dialog", { name: /Apagar/ })
    .getByRole("button", { name: "Apagar" })
    .click();
  await expect(caregiver).toHaveURL(
    new RegExp(`/animais/${petId}/cronologia$`),
  );
  await ctx.close();
});

async function newPhoneContext(browser: Browser) {
  return browser.newContext({
    ...devices["iPhone 15"],
    baseURL: `http://localhost:3100`,
  });
}
