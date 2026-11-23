import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseNewClinic } from "./clinica";

import { todayISO } from "../src/lib/dates";
import { addDaysISO, suggestNextDue } from "../src/lib/vet-visits/next-due";

import { rows, storageObjectExists } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `consulta-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

/** Capturas a 390 px para revisão (só com SHOTS_DIR definido). */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400); // fim das transições
  await page.screenshot({ path: `${dir}/${name}.png` });
}

// PNG 2×2 vermelho.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAdtgL+dZb8dAAAAABJRU5ErkJggg==",
  "base64",
);

test("registar uma consulta completa e confirmar que ficou gravada", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const petId = await createPet(page, "Bolacha", "Cão");
  await openConsulta(page);

  // Cada toque ou escrita conta como uma ação (a abertura pelo «+» são 2 toques).
  let actions = 2;
  const tap = async (l: Locator) => {
    actions++;
    await l.click();
  };
  const write = async (l: Locator, text: string) => {
    actions++;
    await l.fill(text);
  };

  // Um só animal: sem escolher animal; data de hoje por defeito.
  await expect(page.getByLabel(/^Data/)).toHaveValue(todayISO());
  await shot(page, "1-vazio");

  await tap(page.getByRole("button", { name: "Vacinação", exact: true }));
  // Clínica nova: abre o painel, escreve o nome e confirma (3 ações).
  actions += 3;
  await chooseNewClinic(page, "VetLumiar");
  await expect(page.getByTestId("clinic-card")).toContainText("VetLumiar");

  // Vacina: preset pré-selecionado (Antirrábica) e próxima data sugerida (+1 ano).
  await tap(page.getByRole("button", { name: "+ Vacina" }));
  const treatment = page.getByRole("dialog", {
    name: "Vacina ou desparasitação",
  });
  await expect(
    treatment.getByRole("radio", { name: /Antirrábica/ }),
  ).toBeChecked();
  const nextYear = suggestNextDue(todayISO(), 12);
  await expect(treatment.getByLabel("Próxima dose")).toHaveValue(nextYear);
  await shot(page, "3-painel-vacina");
  await tap(treatment.getByRole("button", { name: "Adicionar" }));
  await expect(page.getByText("Antirrábica")).toBeVisible();

  // Medicação: 1× por dia, 7 dias (valores por defeito).
  await tap(page.getByRole("button", { name: "+ Medicação" }));
  const med = page.getByRole("dialog", { name: "Medicação" });
  await write(med.getByLabel("Medicamento"), "Meloxicam");
  await shot(page, "4-painel-medicacao");
  await tap(med.getByRole("button", { name: "Adicionar" }));
  await expect(page.getByText("Meloxicam")).toBeVisible();

  // Peso com vírgula PT
  await tap(page.getByRole("button", { name: "+ Peso" }));
  await write(page.getByLabel("Peso", { exact: true }), "12,4");

  // Custo
  await write(page.getByLabel("Custo em euros"), "45");
  await expect(page.getByText("45,00 €").first()).toBeVisible();

  // Anexo (Mais detalhes → Juntar foto ou PDF → ficheiro)
  await tap(page.getByText("Mais detalhes"));
  await tap(page.getByRole("button", { name: "Juntar foto ou PDF" }));
  await page.getByTestId("attachment-input").setInputFiles({
    name: "fatura.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  actions++; // escolher o ficheiro no seletor do iPhone
  await expect(page.getByText(/^Foto · /)).toBeVisible();

  await page
    .getByRole("heading", { name: "O que foi feito?" })
    .scrollIntoViewIfNeeded();
  await shot(page, "2-preenchido");
  await page.getByText("Notas", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, "2b-detalhes");

  // Guardar → resumo das próximas datas → Guardar
  await tap(page.getByRole("button", { name: "Guardar consulta" }));
  const summary = page.getByRole("dialog", { name: "Está tudo certo?" });
  await expect(summary.getByText("Próximas datas criadas")).toBeVisible();
  await expect(summary.getByLabel("Próxima data de Antirrábica")).toHaveValue(
    nextYear,
  );
  await shot(page, "5-resumo");
  await tap(summary.getByRole("button", { name: "Guardar consulta" }));

  // Sucesso
  await expect(
    page.getByRole("heading", { name: "Consulta guardada" }),
  ).toBeVisible();
  await expect(page.getByText("Peso 12,4 kg")).toBeVisible();
  await expect(page.getByText("Custo 45,00 €")).toBeVisible();

  await shot(page, "6-sucesso");
  console.log(`CONSULTA TÍPICA COMPLETA: ${actions} ações (toques/escritas)`);
  testInfo.annotations.push({ type: "ações", description: String(actions) });
  expect(actions).toBeLessThanOrEqual(20);

  // Gravado na BD, tudo ligado à mesma consulta
  const [visit] = await rows<{
    id: string;
    reason: string;
    clinics: { name: string } | null;
    visited_on: string;
  }>(
    "vet_visits",
    `pet_id=eq.${petId}&select=id,reason,clinics(name),visited_on`,
  );
  expect(visit).toMatchObject({
    reason: "Vacinação",
    clinics: { name: "VetLumiar" },
    visited_on: todayISO(),
  });
  const v = visit!.id;

  const [weight] = await rows<{ weight_kg: string }>(
    "weights",
    `vet_visit_id=eq.${v}&select=weight_kg`,
  );
  expect(Number(weight!.weight_kg)).toBe(12.4);

  const [vaccine] = await rows<{
    title: string;
    type: string;
    next_due_on: string;
    remind: boolean;
    created_by: string;
  }>(
    "health_events",
    `vet_visit_id=eq.${v}&select=title,type,next_due_on,remind,created_by`,
  );
  expect(vaccine).toMatchObject({
    title: "Antirrábica",
    type: "vaccine",
    next_due_on: nextYear,
    remind: true,
  });

  const [medication] = await rows<{
    name: string;
    schedule_rrule: string;
    starts_on: string;
    ends_on: string;
  }>(
    "medications",
    `vet_visit_id=eq.${v}&select=name,schedule_rrule,starts_on,ends_on`,
  );
  expect(medication).toMatchObject({
    name: "Meloxicam",
    starts_on: todayISO(),
  });
  expect(medication!.schedule_rrule).toContain("FREQ=DAILY");
  expect(medication!.schedule_rrule).toContain("BYHOUR=8");
  expect(medication!.ends_on).toBe(addDaysISO(todayISO(), 6));

  const [expense] = await rows<{ amount_cents: number; category: string }>(
    "expenses",
    `vet_visit_id=eq.${v}&select=amount_cents,category`,
  );
  expect(expense).toMatchObject({ amount_cents: 4500, category: "veterinary" });

  const [doc] = await rows<{ storage_path: string; mime_type: string }>(
    "documents",
    `vet_visit_id=eq.${v}&select=storage_path,mime_type`,
  );
  expect(doc!.storage_path.startsWith(`${petId}/`)).toBe(true);
  expect(doc!.mime_type).toBe("image/jpeg");
  expect(await storageObjectExists("documentos", doc!.storage_path)).toBe(true);

  // «Ver na cronologia» não fica partido
  await page.getByRole("link", { name: "Ver na cronologia" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}$`));
  await expect(page.getByRole("heading", { name: "Bolacha" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Vacinação/ })).toBeVisible();
});

test("avisa ao sair com dados por gravar", async ({ page }) => {
  await signIn(page);
  await createPet(page, "Bolacha", "Cão");
  await openConsulta(page);

  // Sem alterações sai logo.
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page).not.toHaveURL(/registar\/consulta/);

  await openConsulta(page);
  await page.getByRole("button", { name: "Check-up", exact: true }).click();
  await page.getByRole("button", { name: "Fechar" }).click();
  const dialog = page.getByRole("dialog", { name: "Sair sem guardar?" });
  await expect(dialog).toBeVisible();
  await shot(page, "7-sair");

  await dialog.getByRole("button", { name: "Continuar a editar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Motivo")).toHaveValue("Check-up");

  await page.getByRole("button", { name: "Fechar" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sair sem guardar" })
    .click();
  await expect(page).not.toHaveURL(/registar\/consulta/);
  expect(await rows("vet_visits", "select=id")).not.toContainEqual(
    expect.objectContaining({ reason: "Check-up" }),
  );
});

test("erro de validação mantém os dados", async ({ page }) => {
  await signIn(page);
  await createPet(page, "Bolacha", "Cão");
  await openConsulta(page);

  // Sem motivo: não grava
  await page.getByRole("button", { name: "Guardar consulta" }).click();
  await expect(page.getByText("Escreve o motivo.")).toBeVisible();
  await expect(page.getByText("Confirma os campos assinalados.")).toBeVisible();

  // Peso e custo inválidos, motivo preenchido: os dados mantêm-se
  await page.getByRole("button", { name: "+ Peso" }).click();
  await page.getByLabel("Peso", { exact: true }).fill("abc");
  await page.getByLabel("Custo em euros").fill("1,234");
  await page.getByLabel("Motivo").fill("Controlo");
  await page.getByRole("button", { name: "Guardar consulta" }).click();
  await expect(
    page.getByText("Escreve o peso, por exemplo 12,4."),
  ).toBeVisible();
  await expect(
    page.getByText("Escreve o valor, por exemplo 45,00."),
  ).toBeVisible();
  await expect(page.getByLabel("Motivo")).toHaveValue("Controlo");
  await expect(page.getByLabel("Peso", { exact: true })).toHaveValue("abc");
  await page
    .getByRole("heading", { name: "Registar consulta" })
    .scrollIntoViewIfNeeded();
  await shot(page, "8-erro");

  // Corrigir e gravar
  await page.getByLabel("Peso", { exact: true }).fill("8");
  await page.getByLabel("Custo em euros").fill("");
  await page.getByRole("button", { name: "Guardar consulta" }).click();
  await expect(
    page.getByRole("heading", { name: "Consulta guardada" }),
  ).toBeVisible();
});

test("vários animais: último usado pré-selecionado; editar e apagar consulta", async ({
  page,
}) => {
  await signIn(page);
  await createPet(page, "Bolacha", "Cão");
  const miauId = await createPet(page, "Miau", "Gato");
  await openConsulta(page);

  // Chips com os dois animais; ainda sem histórico, o primeiro
  const bolacha = page.getByRole("radio", { name: /Bolacha/ });
  const miau = page.getByRole("radio", { name: /Miau/ });
  await expect(bolacha).toBeChecked();
  await miau.click();

  await page.getByRole("button", { name: "Doença", exact: true }).click();
  await page.getByRole("button", { name: "+ Peso" }).click();
  await page.getByLabel("Peso", { exact: true }).fill("4,2");
  await page.getByRole("button", { name: "Guardar consulta" }).click();
  await expect(
    page.getByRole("heading", { name: "Consulta guardada" }),
  ).toBeVisible();

  // Volta a abrir: o Miau vem escolhido e o veterinário/cliníca também
  await openConsulta(page);
  await expect(page.getByRole("radio", { name: /Miau/ })).toBeChecked();

  // Editar: mudar o motivo
  await gotoApp(page, `/animais/${miauId}`);
  await page.getByRole("link", { name: /Doença/ }).click();
  // A ficha mostra primeiro o detalhe (ecrã 18); daí abre-se a edição.
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/consulta\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Editar ou apagar" }).click();
  await expect(page).toHaveURL(/\/registar\/consulta\/[0-9a-f-]+$/);
  await shot(page, "9-editar");
  await page.getByLabel("Motivo").fill("Controlo anual");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${miauId}$`));
  await expect(
    page.getByRole("link", { name: /Controlo anual/ }),
  ).toBeVisible();

  // Apagar com confirmação: o peso fica, sem ligação à consulta
  await page.getByRole("link", { name: /Controlo anual/ }).click();
  await page.getByRole("link", { name: "Editar ou apagar" }).click();
  await page.getByRole("button", { name: "Apagar consulta" }).click();
  const confirm = page.getByRole("dialog", { name: /Apagar a consulta/ });
  await expect(confirm).toContainText("ficam guardados");
  await shot(page, "10-apagar");
  await confirm.getByRole("button", { name: "Apagar consulta" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${miauId}$`));
  await expect(page.getByText("Ainda sem consultas registadas.")).toBeVisible();

  const weights = await rows<{
    weight_kg: string;
    vet_visit_id: string | null;
  }>("weights", `pet_id=eq.${miauId}&select=weight_kg,vet_visit_id`);
  expect(weights).toHaveLength(1);
  expect(Number(weights[0]!.weight_kg)).toBe(4.2);
  expect(weights[0]!.vet_visit_id).toBeNull();
});
