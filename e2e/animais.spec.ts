import { expect, test, type Page } from "@playwright/test";

import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `pets-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

// PNG 2×2 vermelho.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAdtgL+dZb8dAAAAABJRU5ErkJggg==",
  "base64",
);

test("criar, editar, arquivar e reativar um animal", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Animais", exact: true }).click();
  await expect(page).toHaveURL(/\/animais$/);

  // Estado vazio
  await expect(
    page.getByRole("heading", { name: "Adiciona o teu primeiro patudo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Animais arquivados/ }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Adicionar animal" }).click();
  await expect(page).toHaveURL(/\/animais\/novo$/);

  // Sem nome nem espécie não grava
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Escreve o nome.")).toBeVisible();
  await expect(page.getByText("Escolhe se é cão ou gato.")).toBeVisible();

  // Foto + nome + espécie + idade aproximada
  await page.getByTestId("photo-input").setInputFiles({
    name: "bolacha.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByRole("button", { name: "Mudar foto" })).toBeVisible();
  await page.getByLabel("Nome").fill("Bolacha");
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("radio", { name: "Idade aproximada" }).click();
  await page.getByLabel("Idade").fill("3");
  await expect(page.getByText(/^≈ \d{2}\/\d{4}$/)).toBeVisible();
  await page.getByRole("button", { name: "Guardar" }).click();

  // Ecrã «Criado»
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  await expect(
    page.getByRole("heading", { name: "Bolacha já está no Patudos" }),
  ).toBeVisible();
  await expect(page.locator("main img, img").first()).toBeVisible();
  await page.getByRole("link", { name: "Agora não" }).click();

  // Lista: cartão com idade, só dele e foto assinada
  await expect(page).toHaveURL(/\/animais$/);
  const card = page.getByRole("link", { name: /Bolacha/ });
  await expect(card).toContainText("Cão · 3 anos");
  await expect(card).toContainText("Só tu");
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /\/object\/sign\/fotos\//,
  );

  // Editar: raça em «Mais detalhes»
  await card.click();
  await expect(
    page.getByRole("heading", { name: "Editar Bolacha" }),
  ).toBeVisible();
  // Páginas anteriores ficam em cache, escondidas: trabalha só no formulário visível.
  const form = page.locator("form:visible");
  await expect(form.getByLabel("Idade")).toHaveValue("3");
  await form.getByText("Mais detalhes").click();
  await form.getByLabel("Raça").fill("Podengo");
  await form.getByText("Fêmea", { exact: true }).click();
  await form.getByLabel("Nome").fill("Bolachinha");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais$/);
  await expect(page.getByRole("link", { name: /Bolachinha/ })).toContainText(
    "Cadela · Podengo · 3 anos",
  );

  // Arquivar com confirmação
  await page.getByRole("link", { name: /Bolachinha/ }).click();
  await page.getByRole("button", { name: "Arquivar Bolachinha" }).click();
  await expect(page.getByText("Arquivar Bolachinha?")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Arquivar Bolachinha?")).toHaveCount(0);
  await page.getByRole("button", { name: "Arquivar Bolachinha" }).click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page).toHaveURL(/\/animais$/);
  await expect(
    page.getByRole("heading", { name: "Adiciona o teu primeiro patudo" }),
  ).toBeVisible();

  // Arquivados e reativar
  await page.getByRole("link", { name: "Animais arquivados (1)" }).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "Bolachinha" }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Arquivado a \d{2}\/\d{2}\/\d{4}$/).locator("visible=true"),
  ).toBeVisible();
  await page.getByRole("button", { name: /Reativar/ }).click();
  await expect(page).toHaveURL(/\/animais$/);
  await expect(page.getByRole("link", { name: /Bolachinha/ })).toBeVisible();
});
