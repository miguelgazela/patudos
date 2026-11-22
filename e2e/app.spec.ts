import { expect, test, type Page } from "@playwright/test";

import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `app-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

test("manifest e service worker são servidos sem sessão", async ({
  request,
}) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({
    name: "Patudos",
    short_name: "Patudos",
    lang: "pt-PT",
    display: "standalone",
    start_url: "/",
    theme_color: "#0B6B5F",
    background_color: "#F2F5F4",
  });
  expect(m.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );
  for (const icon of m.icons) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }

  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(await sw.text()).not.toMatch(/addEventListener\("fetch"|caches\./);
});

test("metadados Apple no HTML de entrada", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(
    page.locator('meta[name="apple-mobile-web-app-title"]'),
  ).toHaveAttribute("content", "Patudos");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveCount(1);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveCount(
    1,
  );
});

test("separadores, menu + e terminar sessão a partir do Perfil", async ({
  page,
}) => {
  await signIn(page);

  // Hoje: saudação, data por extenso e estado vazio.
  await expect(
    page.getByRole("heading", {
      name: /^(Bom dia|Boa tarde|Boa noite), Rita$/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /^(Segunda|Terça|Quarta|Quinta|Sexta)-feira, \d{1,2} de \w+$|^(Sábado|Domingo), \d{1,2} de \w+$/,
    ),
  ).toBeVisible();
  await expect(page.getByText("Adiciona o teu primeiro patudo")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: "Hoje" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  for (const [label, path, heading] of [
    ["Animais", "/animais", "Animais"],
    ["Despesas", "/despesas", "Despesas"],
    ["Perfil", "/perfil", "Perfil"],
    ["Hoje", "/", /Rita$/],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }

  // Menu +: abre, fecha com «Fechar», com Esc e ao tocar fora; uma ação leva a «Em breve».
  const plus = nav.getByRole("button", { name: "Registar" });
  await plus.click();
  const dialog = page.getByRole("dialog", { name: "O que queres registar?" });
  await expect(dialog).toBeVisible();
  for (const t of ["Consulta", "Tratamento", "Peso", "Despesa", "Documento"]) {
    await expect(
      dialog.getByRole("link", { name: new RegExp(`^${t}\\.`) }),
    ).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog).toBeHidden();

  await plus.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await plus.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(195, 60); // fora do painel
  await expect(dialog).toBeHidden();

  await plus.click();
  await dialog.getByRole("link", { name: /^Consulta\./ }).click();
  await expect(page).toHaveURL(/\/registar\/consulta$/);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Em breve" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Perfil: nome editável, email, termos desativados, terminar sessão.
  await nav.getByRole("link", { name: "Perfil" }).click();
  await expect(page.locator("dd", { hasText: /@exemplo\.pt$/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Termos e privacidade/ }),
  ).toBeDisabled();
  await page.getByLabel("O teu nome").fill("Rita Maria");
  await page.getByRole("button", { name: "Guardar nome" }).click();
  await expect(page.getByText("Nome guardado")).toBeVisible();
  await nav.getByRole("link", { name: "Hoje" }).click();
  await expect(
    page.getByRole("heading", { name: /, Rita Maria$/ }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "Perfil" }).click();
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/animais");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("nada fica escondido pela barra a 390 px; sem ligação mostra aviso", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Perfil" })
    .click();

  const logout = page.getByRole("button", { name: "Terminar sessão" });
  await logout.scrollIntoViewIfNeeded();
  const nav = await page
    .getByRole("navigation", { name: "Principal" })
    .boundingBox();
  const btn = await logout.boundingBox();
  expect(page.viewportSize()?.width).toBe(393);
  expect(btn!.y + btn!.height).toBeLessThanOrEqual(nav!.y);

  await context.setOffline(true);
  await expect(
    page.getByText("Sem ligação à internet. Tenta de novo daqui a pouco."),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByText("Sem ligação à internet. Tenta de novo daqui a pouco."),
  ).toBeHidden();
});
