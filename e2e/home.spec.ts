import { expect, test } from "@playwright/test";

test("a página inicial mostra o nome da app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Patudos" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT");
});
