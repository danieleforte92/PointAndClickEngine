import { expect, test } from "@playwright/test";
import { installEditorMock } from "./editor-fixture";

test("captures a deterministic Asset Studio surface", async ({ page }) => {
  await installEditorMock(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:5174/");

  await page.locator(".workspace-tabs button").filter({ hasText: "Assets" }).click();
  await expect(page.locator(".asset-studio-shell")).toBeVisible();
  await expect(page.getByRole("img", { name: "mock-cabin-art preview" })).toBeVisible();
  await expect(page.getByText("mock-cabin-art", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Filter project resource health")).toBeVisible();
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.locator(".resource-browser-items.grid")).toBeVisible();

  const screenshotPath = process.env.EDITOR_ASSET_STUDIO_SCREENSHOT_PATH;
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  await expect(page.getByLabel("Image optimization comparison")).toBeVisible();
  await expect(page.getByAltText("Source asset preview")).toBeVisible();
  await expect(page.getByAltText("Optimized asset preview")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Apply Derived Asset" })).toBeEnabled();
});
