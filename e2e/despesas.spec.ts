import { expect, test, type Page } from "@playwright/test";

import { todayISO } from "../src/lib/dates";

import { rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `despesa-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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
  await page.screenshot({ path: `${dir}/${name}.png` });
}

async function newExpense(
  page: Page,
  opts: {
    amount: string;
    category: string;
    pets?: string[];
    description?: string;
    date?: string;
  },
) {
  await gotoApp(page, "/registar/despesa");
  await waitForHydratedForm(page);
  await page.getByLabel("Valor", { exact: true }).fill(opts.amount);
  await page.getByRole("button", { name: opts.category, exact: true }).click();
  if (opts.pets) {
    // O último animal usado vem escolhido: acerta cada chip com o que se pede.
    const boxes = page.getByRole("checkbox");
    const n = await boxes.count();
    // Primeiro escolhe os que faltam; só depois tira os que sobram (nunca fica sem animal).
    for (const wantChecked of [true, false]) {
      for (let i = 0; i < n; i++) {
        const box = boxes.nth(i);
        const name = ((await box.textContent()) ?? "").trim();
        const want = opts.pets.includes(name);
        const on = (await box.getAttribute("aria-checked")) === "true";
        if (want === wantChecked && on !== want) await box.click();
      }
    }
  }
  if (opts.description || opts.date) {
    await page.getByText("Mais detalhes").click();
    if (opts.date) await page.getByLabel("Data").fill(opts.date);
    if (opts.description)
      await page.getByLabel("Descrição (opcional)").fill(opts.description);
  }
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Guardar" }).click();
}

test("despesa simples aparece no total do mês", async ({ page }) => {
  await signIn(page);
  await createPet(page, "Mimi", "Gato");
  await newExpense(page, { amount: "45,50", category: "Veterinário" });
  await shot(page, "despesa-nova");
  await save(page);
  await expect(page.getByTestId("expense-saved")).toBeVisible();
  await expect(page.getByTestId("expense-saved")).toContainText("45,50 €");

  await gotoApp(page, "/despesas");
  await expect(page.getByTestId("total")).toHaveText("45,50 €");
  await expect(page.getByTestId("by-pet")).toContainText("Mimi");
  await shot(page, "despesas-mes");

  const [exp] = await rows<{ amount_cents: number; paid_by: string }>(
    "expenses",
    "select=amount_cents,paid_by&category=eq.veterinary",
  );
  expect(exp?.amount_cents).toBe(4550);
});

test("ração dividida por 2 gatos: 25,01 € fica 12,51 + 12,50", async ({
  page,
}) => {
  const desc = `Ração ${Date.now()}`;
  await signIn(page);
  await createPet(page, "Mimi", "Gato");
  await createPet(page, "Tom", "Gato");
  await newExpense(page, {
    amount: "25,01",
    category: "Alimentação",
    pets: ["Mimi", "Tom"],
    description: desc,
  });
  await expect(page.getByTestId("split-card")).toContainText(
    "Dividido em partes iguais",
  );
  const values = [
    await page.getByTestId("split-Mimi").textContent(),
    await page.getByTestId("split-Tom").textContent(),
  ].map((v) => v?.replace(/\s/g, " "));
  expect(values.sort()).toEqual(
    ["12,50 €", "12,51 €"].map((v) => v.replace(/\s/g, " ")),
  );
  await shot(page, "despesa-dividir");

  // Ajustar com soma errada: mensagem clara; depois corrige
  await page.getByRole("button", { name: "Ajustar" }).click();
  await page.getByLabel("Valor para Mimi").fill("10");
  await page.getByLabel("Valor para Tom").fill("10");
  await save(page);
  await expect(page.getByText(/não é igual ao total/)).toBeVisible();
  await page.getByLabel("Valor para Mimi").fill("20");
  await page.getByLabel("Valor para Tom").fill("5,01");
  await save(page);
  await expect(page.getByTestId("expense-saved")).toBeVisible();

  const splits = await rows<{ amount_cents: number }>(
    "expense_splits",
    `select=amount_cents,expenses!inner(description)&expenses.description=eq.${encodeURIComponent(desc)}&order=amount_cents.desc`,
  );
  expect(splits.map((s) => s.amount_cents)).toEqual([2000, 501]);
});

test("editar e apagar", async ({ page }) => {
  await signIn(page);
  await createPet(page, "Mimi", "Gato");
  await newExpense(page, {
    amount: "10",
    category: "Higiene",
    description: "Areia",
  });
  await save(page);
  await expect(page.getByTestId("expense-saved")).toBeVisible();

  await gotoApp(page, "/despesas");
  await page.getByRole("link", { name: /Areia/ }).click();
  await expect(page).toHaveURL(/\/despesas\/[0-9a-f-]+$/);
  await waitForHydratedForm(page);
  await page.getByLabel("Valor", { exact: true }).fill("12,30");
  await save(page);
  await expect(page).toHaveURL(/\/despesas\?p=/);
  await expect(page.getByTestId("total")).toHaveText("12,30 €");

  await page.getByRole("link", { name: /Areia/ }).click();
  await waitForHydratedForm(page);
  await page.getByRole("button", { name: "Apagar despesa" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();
  await expect(page).toHaveURL(/\/despesas$/);
  await expect(page.getByText(/Sem despesas em/)).toBeVisible();
  await shot(page, "despesas-vazio");
});

test("filtros e total anual por animal", async ({ page }) => {
  await signIn(page);
  await createPet(page, "Mimi", "Gato");
  await createPet(page, "Rex", "Cão");
  const year = todayISO().slice(0, 4);
  await newExpense(page, {
    amount: "20",
    category: "Alimentação",
    pets: ["Mimi"],
  });
  await save(page);
  await expect(page.getByTestId("expense-saved")).toBeVisible();
  await newExpense(page, {
    amount: "30",
    category: "Veterinário",
    pets: ["Rex"],
    date: `${year}-01-05`,
  });
  await save(page);
  await expect(page.getByTestId("expense-saved")).toBeVisible();

  // Mês atual: só a despesa de hoje (se hoje não for janeiro, a de janeiro fica de fora)
  await gotoApp(page, "/despesas");
  const inJanuary = todayISO().slice(5, 7) === "01";
  if (!inJanuary) await expect(page.getByTestId("total")).toHaveText("20,00 €");

  // Ano: 50,00 € com a divisão por animal
  await gotoApp(page, `/despesas?p=${year}`);
  await expect(page.getByTestId("total")).toHaveText("50,00 €");
  await expect(page.getByTestId("by-pet")).toContainText("Mimi");
  await expect(page.getByTestId("by-pet")).toContainText("20,00 €");
  await expect(page.getByTestId("by-pet")).toContainText("Rex");
  await expect(page.getByTestId("by-pet")).toContainText("30,00 €");
  await shot(page, "despesas-ano");

  // Filtro por animal
  await page.getByRole("link", { name: "Rex", exact: true }).click();
  await expect(page.getByTestId("total")).toHaveText("30,00 €");
  // Filtro por categoria
  await gotoApp(page, `/despesas?p=${year}`);
  await page.getByText("Filtros: categoria e quem pagou").click();
  await page.getByRole("link", { name: "Alimentação", exact: true }).click();
  await expect(page.getByTestId("total")).toHaveText("20,00 €");
  // Filtro por quem pagou: eu
  await gotoApp(page, `/despesas?p=${year}`);
  await page.getByText("Filtros: categoria e quem pagou").click();
  await page.getByRole("link", { name: "Eu", exact: true }).click();
  await expect(page.getByTestId("total")).toHaveText("50,00 €");
});
