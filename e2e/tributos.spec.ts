import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

import { rows } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// PNG 2×2 vermelho.
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

async function signIn(page: Page, name: string) {
  const email = `tributo-${unique()}@exemplo.pt`;
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

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("«Em memória de…»: cria o tributo, deixa uma memória com foto e aparece na lista", async ({
  page,
}) => {
  await signIn(page, "Rita");
  await page.goto("/animais/novo").catch(() => page.goto("/animais/novo"));
  await page.getByRole("link", { name: "Em memória de…" }).click();
  await expect(page).toHaveURL(/\/animais\/memoria$/);
  await waitForHydratedForm(page);
  const form = page.locator("form").filter({ hasText: "Era um…" });
  await shot(page, "t1-em-memoria-form");

  // Nome, espécie e data são obrigatórios
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Escreve o nome.")).toBeVisible();
  await expect(form.getByText("Escolhe se era cão ou gato.")).toBeVisible();
  await expect(form.getByText("Escolhe uma data válida.")).toBeVisible();

  await form.getByTestId("photo-input").setInputFiles({
    name: "nero.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await form.getByLabel("Nome").fill("Nero");
  await form.getByText("Gato", { exact: true }).click();
  // Setembro de um ano passado (mês e ano)
  await form.getByLabel("Mês e ano").fill("2026-09");
  await form.getByLabel("Umas palavras (opcional)").fill("Dormia ao sol.");
  await form.getByRole("button", { name: "Guardar" }).click();

  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/tributo$/);
  const petId = /\/animais\/([0-9a-f-]+)\/tributo$/.exec(page.url())![1]!;
  await expect(page.getByRole("heading", { name: "Nero" })).toBeVisible();
  await expect(page.getByText("Em memória", { exact: true })).toBeVisible();
  await expect(page.getByText("2026", { exact: true })).toBeVisible();
  await expect(page.getByText(/Faleceu em setembro de 2026/)).toBeVisible();
  await expect(page.getByText("Dormia ao sol.")).toBeVisible();
  await expect(
    page.getByText("Ainda ninguém deixou uma memória"),
  ).toBeVisible();

  // Fica arquivado e falecido; não conta como ativo
  const [pet] = await rows<{
    archived_at: string | null;
    deceased_on: string;
    deceased_precision: string;
  }>(
    "pets",
    `id=eq.${petId}&select=archived_at,deceased_on,deceased_precision`,
  );
  expect(pet!.archived_at).not.toBeNull();
  expect(pet!.deceased_on).toBe("2026-09-01");
  expect(pet!.deceased_precision).toBe("month");

  // Memória com foto
  await page.getByRole("button", { name: "Deixar uma memória" }).click();
  const sheet = page.getByRole("dialog", { name: "Uma memória de Nero" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("A tua memória").fill("Esperava-me à porta.");
  await sheet.getByTestId("memory-photo-input").setInputFiles({
    name: "m.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(sheet.getByRole("button", { name: "Mudar foto" })).toBeVisible();
  await shot(page, "t2-memoria-painel");
  await sheet.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Esperava-me à porta.")).toBeVisible();
  await expect(page.getByText(/^Tu · \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
  await shot(page, "t3-tributo");

  // Editar a minha memória e apagá-la
  await page.getByRole("button", { name: "Opções da memória" }).click();
  await page.getByRole("button", { name: "Editar" }).click();
  const edit = page.getByRole("dialog", { name: "Editar memória" });
  await edit.getByLabel("A tua memória").fill("Esperava-me sempre à porta.");
  await edit.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Esperava-me sempre à porta.")).toBeVisible();
  await page.getByRole("button", { name: "Opções da memória" }).click();
  await page.getByRole("button", { name: "Apagar", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .or(page.getByRole("dialog", { name: "Apagar esta memória?" }))
    .getByRole("button", { name: "Apagar" })
    .click();
  await expect(page.getByText("Esperava-me sempre à porta.")).toHaveCount(0);

  // Aparece em «Em memória» na lista de Animais (e não no vazio)
  await page.goto("/animais");
  await expect(page.getByRole("heading", { name: "Em memória" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Adiciona o teu primeiro patudo" }),
  ).toHaveCount(0);
  await shot(page, "t4-lista-em-memoria");
  await page.getByRole("link", { name: /Nero/ }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/tributo$`));

  // O historial continua acessível, só de leitura
  await page.getByRole("link", { name: "Ver o historial de saúde" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}$`));
  await expect(
    page.getByRole("link", { name: "Registar consulta" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ver tributo/ })).toBeVisible();

  // Anular: «Afinal não faleceu» devolve o animal à lista, e pode voltar a ser marcado
  await page.goto(`/animais/${petId}/tributo`);
  await page.getByRole("button", { name: "Afinal não faleceu" }).click();
  await page.getByRole("button", { name: "Sim, desfazer" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}$`));
  const [back] = await rows<{
    archived_at: string | null;
    deceased_on: string | null;
  }>("pets", `id=eq.${petId}&select=archived_at,deceased_on`);
  expect(back).toEqual({ archived_at: null, deceased_on: null });
  await page.goto(`/animais/${petId}/tributo`);
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}$`));
  await page.goto("/animais");
  await expect(page.getByRole("link", { name: /Nero/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Em memória" })).toHaveCount(
    0,
  );

  // Voltar a marcar como falecido: o texto do dono continua lá (as memórias foram apagadas)
  await page.goto(`/animais/${petId}`);
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page.getByRole("button", { name: "Arquivar" }).click();
  const again = page.getByRole("dialog", { name: "Arquivar Nero" });
  await again.getByText("Faleceu", { exact: true }).click();
  await again.getByRole("radio", { name: "Ano" }).click();
  await again.getByLabel("Ano").fill("2026");
  await again.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/tributo$`));
  await expect(page.getByText("Dormia ao sol.")).toBeVisible();

  // Editar o tributo (dono)
  await page.goto(`/animais/${petId}/tributo/editar`);
  await waitForHydratedForm(page);
  await page
    .getByLabel("Umas palavras (opcional)")
    .fill("Dormia sempre ao sol.");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Dormia sempre ao sol.")).toBeVisible();
});

test("arquivar como «Faleceu», memórias do cuidador e permissões", async ({
  browser,
}) => {
  const owner = await newPhone(browser);
  const mom = await newPhone(browser);
  await signIn(owner, "Pedro");
  const momEmail = await signIn(mom, "Mãe");

  // Dono cria o animal
  await owner.goto("/animais/novo");
  await waitForHydratedForm(owner);
  await owner.getByLabel("Nome").fill("Rex");
  await owner.getByText("Cão", { exact: true }).click();
  await owner.getByRole("button", { name: "Guardar" }).click();
  await expect(owner).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  const petId = /\/animais\/([0-9a-f-]+)\/criado$/.exec(owner.url())![1]!;

  // Mãe é cuidadora (montado pela BD)
  const [profile] = await rows<{ id: string }>(
    "profiles",
    `email=eq.${encodeURIComponent(momEmail)}&select=id`,
  );
  const { insertRow } = await import("./db");
  await insertRow("pet_members", {
    pet_id: petId,
    user_id: profile!.id,
    role: "caregiver",
  });

  // Antes de falecer, não há tributo (vai para a ficha)
  await mom.goto(`/animais/${petId}/tributo`);
  await expect(mom).toHaveURL(new RegExp(`/animais/${petId}$`));
  await mom.getByRole("button", { name: "Mais opções" }).click();
  await expect(mom.getByRole("button", { name: "Arquivar" })).toHaveCount(0);

  // Dono arquiva como «Faleceu», com data inválida primeiro
  await owner.goto(`/animais/${petId}`);
  await owner.getByRole("button", { name: "Mais opções" }).click();
  await owner.getByRole("button", { name: "Arquivar" }).click();
  const sheet = owner.getByRole("dialog", { name: "Arquivar Rex" });
  await sheet.getByText("Faleceu", { exact: true }).click();
  await expect(sheet.getByLabel("Data")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await shot(owner, "t5-arquivar-faleceu");
  await sheet.getByRole("radio", { name: "Ano" }).click();
  await sheet.getByLabel("Ano").fill("2030");
  await sheet.getByRole("button", { name: "Guardar" }).click();
  await expect(sheet.getByText("A data não pode ser no futuro.")).toBeVisible();
  await sheet.getByLabel("Ano").fill("2026");
  await sheet.getByRole("button", { name: "Guardar" }).click();
  await expect(owner).toHaveURL(new RegExp(`/animais/${petId}/tributo$`));

  // Mãe deixa uma memória; o dono vê-a assinada e pode apagá-la; Mãe não edita a do dono
  await mom.goto(`/animais/${petId}/tributo`);
  await mom.getByRole("button", { name: "Deixar uma memória" }).click();
  const mSheet = mom.getByRole("dialog", { name: "Uma memória de Rex" });
  await mSheet.getByLabel("A tua memória").fill("Adorava a minha manta.");
  await mSheet.getByRole("button", { name: "Guardar" }).click();
  await expect(mom.getByText("Adorava a minha manta.")).toBeVisible();

  await owner.goto(`/animais/${petId}/tributo`);
  await expect(owner.getByText("Adorava a minha manta.")).toBeVisible();
  await expect(owner.getByText(/^Mãe · \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
  await shot(owner, "t6-memoria-assinada");
  await owner.getByRole("button", { name: "Opções da memória" }).click();
  // O dono só vê «Apagar» na memória de outra pessoa
  await expect(owner.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(owner.getByRole("button", { name: "Apagar" })).toBeVisible();

  // Mãe não edita o tributo
  await mom.goto(`/animais/${petId}/tributo/editar`);
  await expect(mom).toHaveURL(new RegExp(`/animais/${petId}/tributo$`));
  await expect(mom.getByRole("link", { name: "Editar o tributo" })).toHaveCount(
    0,
  );

  // Falecidos não geram lembretes: nada ativo na BD para este animal
  const arch = await rows<{ archived_at: string; deceased_on: string }>(
    "pets",
    `id=eq.${petId}&select=archived_at,deceased_on`,
  );
  expect(arch[0]!.deceased_on).toBe("2026-01-01");
});
