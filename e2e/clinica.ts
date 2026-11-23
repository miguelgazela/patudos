import type { Page } from "@playwright/test";

/** Escolhe uma clínica nova (só o nome) no cartão da consulta, sem sair do ecrã. */
export async function chooseNewClinic(page: Page, name: string) {
  await page.getByTestId("clinic-card").click();
  const sheet = page.getByRole("dialog", { name: "Clínica" });
  await sheet.getByLabel("Nova clínica").fill(name);
  await sheet.getByRole("button", { name: "Usar esta clínica" }).click();
}
