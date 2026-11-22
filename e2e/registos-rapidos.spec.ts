import { expect, test, type Page } from "@playwright/test";

import { todayISO } from "../src/lib/dates";
import { addDaysISO, suggestNextDue } from "../src/lib/vet-visits/next-due";

import { rows } from "./db";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `rapido-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

async function gotoApp(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch {
    await page.goto(url);
  }
}

async function createPet(page: Page, name: string, species: "Cão" | "Gato") {
  await gotoApp(page, "/animais/novo");
  await page.getByLabel("Nome").fill(name);
  await page.getByText(species, { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  return /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;
}

async function openFromMenu(page: Page, action: "Tratamento" | "Peso") {
  await gotoApp(page, "/");
  await page.getByRole("button", { name: "Registar" }).click();
  await page.getByRole("link", { name: new RegExp(`^${action}\\.`) }).click();
}

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test("tratamento com custo: grava evento e despesa; «Registar outro» limpa", async ({
  page,
}) => {
  await signIn(page);
  const petId = await createPet(page, "Bolacha", "Cão");
  await openFromMenu(page, "Tratamento");
  await expect(page).toHaveURL(/\/registar\/tratamento$/);
  // Um só animal: sem chips para escolher.
  await expect(page.getByRole("radiogroup", { name: "Animal" })).toHaveCount(0);
  await expect(page.getByLabel(/^Data/)).toHaveValue(todayISO());
  await shot(page, "t1-vazio");

  // Data passada (vacina antiga): a próxima data acompanha-a.
  const past = addDaysISO(todayISO(), -400);
  await page.getByLabel(/^Data/).fill(past);
  await expect(page.getByLabel("Próxima dose")).toHaveValue(
    suggestNextDue(past, 12),
  );
  await page.getByLabel(/^Produto/).fill("Nobivac");
  await page.getByText("Custo", { exact: true }).click();
  await page.getByLabel("Custo em euros").fill("18,5");
  await shot(page, "t2-preenchido");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("treatment-saved")).toBeVisible();
  await shot(page, "t3-guardado");

  const events = await rows<{
    id: string;
    type: string;
    product: string;
    occurred_on: string;
    next_due_on: string;
    remind: boolean;
  }>("health_events", `pet_id=eq.${petId}&select=*`);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: "vaccine",
    product: "Nobivac",
    occurred_on: past,
    next_due_on: suggestNextDue(past, 12),
    remind: true,
  });
  const splits = await rows<{
    amount_cents: number;
    expenses: { category: string; amount_cents: number; spent_on: string };
  }>(
    "expense_splits",
    `pet_id=eq.${petId}&select=amount_cents,expenses(category,amount_cents,spent_on)`,
  );
  expect(splits).toHaveLength(1);
  expect(splits[0]!.expenses).toMatchObject({
    category: "medication",
    amount_cents: 1850,
    spent_on: past,
  });

  // Registar outro: formulário limpo, outra vez hoje.
  await page.getByRole("button", { name: "Registar outro" }).click();
  await expect(page.getByLabel(/^Data/)).toHaveValue(todayISO());
  await expect(page.getByLabel(/^Produto/)).toHaveValue("");
});

test("peso: atualiza a referência «Último» e grava na BD", async ({ page }) => {
  await signIn(page);
  const petId = await createPet(page, "Mimi", "Gato");
  await openFromMenu(page, "Peso");
  await expect(page).toHaveURL(/\/registar\/peso$/);
  await expect(page.getByTestId("last-weight")).toHaveCount(0);

  await page.getByLabel("Peso", { exact: true }).fill("4,35");
  await shot(page, "p1-preenchido");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("weight-saved")).toBeVisible();
  await shot(page, "p2-guardado");

  const w = await rows<{ weight_kg: number; measured_on: string }>(
    "weights",
    `pet_id=eq.${petId}&select=weight_kg,measured_on`,
  );
  expect(w).toHaveLength(1);
  expect(Number(w[0]!.weight_kg)).toBe(4.35);
  expect(w[0]!.measured_on).toBe(todayISO());

  await page.getByRole("button", { name: "Registar outro" }).click();
  await expect(page.getByTestId("last-weight")).toContainText(
    "Último: 4,35 kg",
  );

  // Pela ficha do animal: atalho já com o animal escolhido e referência vinda da BD.
  await gotoApp(page, `/animais/${petId}`);
  await page.getByRole("link", { name: "Registar peso" }).click();
  await expect(page.getByTestId("last-weight")).toContainText(
    "Último: 4,35 kg",
  );
});

test("menu «+» com dois animais: último usado pré-selecionado", async ({
  page,
}) => {
  await signIn(page);
  await createPet(page, "Bolacha", "Cão");
  await createPet(page, "Mimi", "Gato");
  await openFromMenu(page, "Peso");
  const group = page.getByRole("radiogroup", { name: "Animal" });
  await expect(group.getByRole("radio", { name: "Bolacha" })).toBeChecked();
  await shot(page, "p3-dois-animais");

  await group.getByRole("radio", { name: "Mimi" }).click();
  await page.getByLabel("Peso", { exact: true }).fill("4,1");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("weight-saved")).toBeVisible();

  // Agora o último usado é a Mimi, também no tratamento.
  await openFromMenu(page, "Tratamento");
  await expect(
    page
      .getByRole("radiogroup", { name: "Animal" })
      .getByRole("radio", { name: "Mimi" }),
  ).toBeChecked();
});
