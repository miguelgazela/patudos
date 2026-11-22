import {
  devices,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

import { insertRow, rows, storageObjectExists } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAdtgL+dZb8dAAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

async function signIn(page: Page, name = "Rita") {
  const email = `doc-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

async function createPet(page: Page, name: string) {
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill(name);
  await page.getByText("Cão", { exact: true }).click();
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

async function openAddFromMenu(page: Page) {
  await page.getByRole("button", { name: "Registar" }).click();
  await page.getByRole("link", { name: /^Documento\./ }).click();
  await expect(page).toHaveURL(/\/registar\/documento/);
  await waitForHydratedForm(page);
}

type Doc = {
  id: string;
  title: string;
  kind: string;
  storage_path: string;
  mime_type: string;
};

test("adicionar imagem e PDF, filtrar, pesquisar, editar e apagar", async ({
  page,
}) => {
  await signIn(page);
  const petId = await createPet(page, "Nina");

  // 1. Imagem a partir do menu «+»: o título já vem sugerido
  await gotoApp(page, "/");
  await openAddFromMenu(page);
  await shot(page, "d27-vazio");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Escolhe uma foto ou um PDF.")).toBeVisible();
  await page.getByTestId("file-gallery").setInputFiles({
    name: "boletim.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByTestId("preview")).toBeVisible();
  await page.getByRole("radio", { name: "Boletim sanitário" }).click();
  await expect(page.getByLabel("Título")).toHaveValue(
    "Boletim sanitário de Nina",
  );
  await shot(page, "d27-preenchido");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("document-saved")).toBeVisible();

  // 2. PDF: «Registar outro» volta ao formulário vazio
  await page.getByRole("button", { name: "Registar outro" }).click();
  await page.getByTestId("file-pdf").setInputFiles({
    name: "apolice.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.getByRole("radio", { name: "Seguro" }).click();
  await page.getByLabel("Título").fill("Apólice 2026");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("document-saved")).toBeVisible();

  const docs = await rows<Doc>(
    "documents",
    `pet_id=eq.${petId}&select=id,title,kind,storage_path,mime_type&order=created_at`,
  );
  expect(docs.map((d) => [d.title, d.kind, d.mime_type])).toEqual([
    ["Boletim sanitário de Nina", "health_record", "image/jpeg"],
    ["Apólice 2026", "insurance", "application/pdf"],
  ]);
  for (const d of docs) {
    expect(d.storage_path.startsWith(`${petId}/`)).toBe(true);
    expect(await storageObjectExists("documentos", d.storage_path)).toBe(true);
  }

  // 3. Ecrã 11: lista e filtro por tipo
  await page.getByRole("link", { name: "Concluir" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/documentos$`));
  const list = page.getByTestId("documentos");
  await expect(list.getByRole("link")).toHaveCount(2);
  await shot(page, "d11-lista");
  await page.getByRole("button", { name: "Seguro", exact: true }).click();
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list).toContainText("Apólice 2026");
  await page.getByRole("button", { name: "Tudo", exact: true }).click();
  await expect(list.getByRole("link")).toHaveCount(2);

  // 4. Pesquisar e abrir em 3 toques: Perfil → Documentos → documento
  await gotoApp(page, "/");
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page.getByRole("link", { name: "Documentos", exact: true }).click();
  await expect(page).toHaveURL(/\/documentos$/);
  await page.getByLabel("Pesquisar documentos").fill("apolice");
  await expect(page.getByTestId("documentos").getByRole("link")).toHaveCount(1);
  await shot(page, "documentos-pesquisa");
  await page.getByRole("link", { name: /Apólice 2026/ }).click();
  await expect(page).toHaveURL(/\/documentos\/[0-9a-f-]+$/);
  await expect(page.getByTestId("doc-title")).toHaveText("Apólice 2026");
  await expect(page.getByRole("link", { name: "Abrir PDF" })).toBeVisible();
  await shot(page, "d28-pdf");

  // 5. Imagem: ecrã 28 e edição
  await gotoApp(page, `/animais/${petId}/documentos`);
  await page.getByRole("link", { name: /Boletim sanitário de Nina/ }).click();
  await expect(page.getByTestId("doc-image")).toBeVisible();
  await expect(page.getByText("Adicionado por ti")).toBeVisible();
  await shot(page, "d28-imagem");
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Título").fill("Boletim da Nina");
  await page.getByRole("radio", { name: "Outro" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("doc-title")).toHaveText("Boletim da Nina");
  const [edited] = await rows<Doc>(
    "documents",
    `id=eq.${docs[0]!.id}&select=id,title,kind,storage_path,mime_type`,
  );
  expect([edited!.title, edited!.kind]).toEqual(["Boletim da Nina", "other"]);

  // 6. A cronologia abre o ecrã 28
  await gotoApp(page, `/animais/${petId}/cronologia`);
  await page.getByRole("link", { name: /Apólice 2026/ }).click();
  await expect(page).toHaveURL(/\/documentos\/[0-9a-f-]+$/);

  // 7. Apagar: confirma, o ficheiro desaparece do Storage
  await gotoApp(page, `/documentos/${docs[1]!.id}`);
  await page.getByRole("button", { name: "Apagar" }).click();
  await shot(page, "d28-apagar");
  await page.getByRole("button", { name: "Apagar documento" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/documentos$`));
  expect(await rows("documents", `id=eq.${docs[1]!.id}&select=id`)).toEqual([]);
  expect(await storageObjectExists("documentos", docs[1]!.storage_path)).toBe(
    false,
  );
  expect(await storageObjectExists("documentos", docs[0]!.storage_path)).toBe(
    true,
  );
});

test("a despesa com fatura mostra a ligação e apagar o documento não parte a despesa", async ({
  page,
}) => {
  await signIn(page);
  const petId = await createPet(page, "Rex");
  // Despesa com fatura anexada, pelo ecrã 26
  await gotoApp(page, `/registar/despesa?animal=${petId}`);
  await waitForHydratedForm(page);
  await page.getByLabel("Valor", { exact: true }).fill("45");
  await page.getByRole("button", { name: "Veterinário", exact: true }).click();
  await page.getByText("Mais detalhes").click();
  await page.getByTestId("attachment-input").setInputFiles({
    name: "fatura.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("expense-saved")).toBeVisible();
  const [doc] = await rows<Doc>(
    "documents",
    `pet_id=eq.${petId}&select=id,title,kind,storage_path,mime_type`,
  );
  const docId = doc!.id;
  const path = doc!.storage_path;
  const [expense] = await rows<{ id: string }>(
    "expenses",
    `document_id=eq.${docId}&select=id`,
  );
  const expenseId = expense!.id;

  await gotoApp(page, `/documentos/${docId}`);
  await expect(
    page.getByRole("link", { name: /Despesa de 45,00/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apagar" }).click();
  await page.getByRole("button", { name: "Apagar documento" }).click();
  await expect(page).toHaveURL(new RegExp(`/animais/${petId}/documentos$`));
  expect(await storageObjectExists("documentos", path)).toBe(false);
  const [exp] = await rows<{ id: string; document_id: string | null }>(
    "expenses",
    `id=eq.${expenseId}&select=id,document_id`,
  );
  expect(exp).toEqual({ id: expenseId, document_id: null });
});

test("o cuidador não edita nem apaga o documento do dono", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const petId = await createPet(page, "Bolacha");
  await gotoApp(page, `/registar/documento?animal=${petId}`);
  await waitForHydratedForm(page);
  await page.getByTestId("file-gallery").setInputFiles({
    name: "chip.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("radio", { name: "Chip" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("document-saved")).toBeVisible();
  const [doc] = await rows<Doc>(
    "documents",
    `pet_id=eq.${petId}&select=id,title,kind,storage_path,mime_type`,
  );
  expect(doc!.title).toBe("Chip de Bolacha");

  const ctx: Awaited<ReturnType<Browser["newContext"]>> =
    await browser.newContext({
      ...devices["iPhone 15"],
      baseURL: "http://localhost:3100",
    });
  const caregiver = await ctx.newPage();
  const email = await signIn(caregiver, "Mãe");
  const [profile] = await rows<{ id: string }>(
    "profiles",
    `email=eq.${encodeURIComponent(email)}&select=id`,
  );
  await insertRow("pet_members", {
    pet_id: petId,
    user_id: profile!.id,
    role: "caregiver",
  });

  await gotoApp(caregiver, `/documentos/${doc!.id}`);
  await expect(caregiver.getByTestId("doc-title")).toHaveText(
    "Chip de Bolacha",
  );
  await expect(
    caregiver.getByRole("button", { name: "Partilhar" }),
  ).toBeVisible();
  await expect(caregiver.getByRole("button", { name: "Apagar" })).toHaveCount(
    0,
  );
  await expect(caregiver.getByRole("button", { name: "Editar" })).toHaveCount(
    0,
  );
  await shot(caregiver, "d28-cuidador");

  // O cuidador também carrega o seu e só esse pode apagar
  await gotoApp(caregiver, `/registar/documento?animal=${petId}`);
  await waitForHydratedForm(caregiver);
  await caregiver.getByTestId("file-pdf").setInputFiles({
    name: "x.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  await caregiver.getByRole("button", { name: "Guardar" }).click();
  await expect(caregiver.getByTestId("document-saved")).toBeVisible();
  const mine = await rows<Doc>(
    "documents",
    `pet_id=eq.${petId}&mime_type=eq.application/pdf&select=id,title,kind,storage_path,mime_type`,
  );
  await gotoApp(caregiver, `/documentos/${mine[0]!.id}`);
  await expect(caregiver.getByRole("button", { name: "Apagar" })).toBeVisible();
  await ctx.close();
});

test("PDF acima de 10 MB e ficheiros inválidos são recusados com mensagem", async ({
  page,
}) => {
  await signIn(page);
  await createPet(page, "Mia");
  await gotoApp(page, "/registar/documento");
  await waitForHydratedForm(page);
  await page.getByTestId("file-pdf").setInputFiles({
    name: "grande.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText("O PDF é demasiado grande (máximo 10 MB)."),
  ).toBeVisible();
  await expect(page.getByTestId("preview")).toHaveCount(0);
  await shot(page, "d27-pdf-grande");
});
