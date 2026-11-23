import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { insertRow } from "./db";
import { waitForHydratedForm } from "./hydrated";
import { latestCode } from "./mailpit";

async function signIn(page: Page, name = "Rita") {
  const email = `axe-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemplo.pt`;
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

/**
 * Violações «sérias» e «críticas» do axe. Exceções documentadas (nenhuma por agora):
 * acrescentar aqui `{ id, motivo }` se alguma não fizer sentido corrigir.
 */
const IGNORED: { id: string; motivo: string }[] = [];

async function expectNoSeriousViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      ...(process.env.AXE_ALL ? ["best-practice"] : []),
    ])
    .disableRules(IGNORED.map((i) => i.id))
    .analyze();
  const bad = results.violations.filter(
    (v) =>
      v.impact === "serious" ||
      v.impact === "critical" ||
      // AXE_ALL=1 mostra também as moderadas e menores (revisão manual).
      (!!process.env.AXE_ALL && !!v.impact),
  );
  const summary = bad.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ` +
      v.nodes
        .slice(0, 4)
        .map(
          (n) =>
            `${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1] ?? ""}`,
        )
        .join("\n  "),
  );
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

test("axe: sem violações sérias nos ecrãs principais, com dados", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page);

  // Animal
  await gotoApp(page, "/animais/novo");
  await waitForHydratedForm(page);
  await page.getByLabel("Nome").fill("Bolacha");
  await page.getByText("Cão", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/animais\/[0-9a-f-]+\/criado$/);
  const petId = /\/animais\/([0-9a-f-]+)\/criado$/.exec(page.url())![1]!;

  // Consulta completa (cria vacina, medicação, peso e despesa)
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

  // Lembrete manual e documento (só a linha: a lista não abre o ficheiro)
  await insertRow("reminders", {
    pet_id: petId,
    title: "Banho",
    due_at: new Date(Date.now() + 86_400_000).toISOString(),
    channels: ["push"],
  });
  await insertRow("documents", {
    pet_id: petId,
    kind: "invoice",
    title: "Fatura da vacina",
    storage_path: `${petId}/_axe.pdf`,
    mime_type: "application/pdf",
  });

  const screens: [string, string][] = [
    ["Hoje", "/"],
    ["Animais", "/animais"],
    ["Ficha · Resumo", `/animais/${petId}`],
    ["Ficha · Cronologia", `/animais/${petId}/cronologia`],
    ["Ficha · Peso", `/animais/${petId}/peso`],
    ["Ficha · Documentos", `/animais/${petId}/documentos`],
    ["Lembretes", `/animais/${petId}/lembretes`],
    ["Novo lembrete", `/animais/${petId}/lembretes/novo`],
    ["Pessoas", `/animais/${petId}/pessoas`],
    ["Editar animal", `/animais/${petId}/editar`],
    ["Despesas", "/despesas"],
    ["Documentos", "/documentos"],
    ["Perfil", "/perfil"],
    ["Notificações", "/perfil/notificacoes"],
    ["Calendário", "/perfil/calendario"],
    ["Arquivados", "/animais/arquivados"],
    ["Registar consulta", "/registar/consulta"],
    ["Registar peso", "/registar/peso"],
    ["Registar despesa", "/registar/despesa"],
    ["Registar documento", "/registar/documento"],
    ["404", `/animais/00000000-0000-0000-0000-000000000000`],
  ];
  for (const [label, url] of screens) {
    await gotoApp(page, url);
    await expect(page.locator("h1").first()).toBeVisible();
    await expectNoSeriousViolations(page, label);
  }
});
