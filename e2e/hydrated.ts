import type { Page } from "@playwright/test";

/**
 * Espera que o React tenha hidratado o formulário. Antes disso, escrever ou
 * tocar em «Guardar» não faz nada (a Server Action ainda não está ligada) e a
 * página fica no mesmo sítio, sobretudo com a máquina carregada.
 */
export async function waitForHydratedForm(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return (
      !!form && Object.keys(form).some((k) => k.startsWith("__reactProps$"))
    );
  });
}
