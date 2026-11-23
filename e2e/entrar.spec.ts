import { expect, test, type Page } from "@playwright/test";

import { latestCode } from "./mailpit";

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
}

async function askForCode(page: Page, email: string) {
  await page.goto("/entrar");
  // No Safari sem a app instalada aparece primeiro o ecrã «Instalar».
  await expect(
    page.getByRole("heading", { name: "Instala os Patudos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar no browser" }).click();

  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByLabel("O teu email").fill(email);
  const sentAt = Date.now() - 1000;
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
  return sentAt;
}

test("sem sessão, / mostra a apresentação e uma rota privada leva a /entrar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "Começar" }).first(),
  ).toBeVisible();
  await page.goto("/animais");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("email inválido mostra o erro por baixo do campo", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Continuar no browser" }).click();
  await page.getByLabel("O teu email").fill("ana@");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByText("Escreve um email válido")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
});

test("fluxo completo: código, nome, Bom dia, sair e voltar a entrar", async ({
  page,
}) => {
  const email = uniqueEmail("ana");
  const sentAt = await askForCode(page, email);

  await expect(page.locator("strong", { hasText: email })).toBeVisible();
  await expect(page.getByText(/Reenviar código em 0:\d\d/)).toBeVisible();

  const code = await latestCode(email, sentAt);
  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(code);

  // Primeiro login: pede o nome.
  await expect(page).toHaveURL(/\/bem-vindo$/);
  await expect(
    page.getByRole("heading", { name: "Como te chamas?" }),
  ).toBeVisible();
  await page.getByLabel("O teu nome").fill("Ana");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), Ana$/ }),
  ).toBeVisible();

  // A sessão mantém-se ao recarregar.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), Ana$/ }),
  ).toBeVisible();

  // «Terminar sessão» fica no Perfil.
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Perfil" })
    .click();
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  // Segundo login: já tem nome, vai direto para «Hoje».
  await page.getByLabel("O teu email").fill(email);
  const secondSentAt = Date.now() - 1000;
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(await latestCode(email, secondSentAt));
  await expect(
    page.getByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite), Ana$/ }),
  ).toBeVisible();
});

test("código errado mostra o erro e limpa as caixas", async ({ page }) => {
  const email = uniqueEmail("errado");
  const sentAt = await askForCode(page, email);
  const real = await latestCode(email, sentAt);
  const wrong = real === "000000" ? "111111" : "000000";

  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(wrong);

  await expect(page.getByText("Código errado")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar\/codigo$/);
  await expect(page.getByLabel("Dígito 1 de 6")).toHaveValue("");

  // E o código certo ainda funciona.
  await page.getByLabel("Dígito 1 de 6").click();
  await page.keyboard.type(real);
  await expect(page).toHaveURL(/\/bem-vindo$/);
});
