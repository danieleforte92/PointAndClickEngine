import { expect, test } from "@playwright/test";
import { installEditorMock } from "./editor-fixture";

test("keeps scene selection and local view preferences contextual", async ({ page }) => {
  await installEditorMock(page);
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".workspace-tabs button").filter({ hasText: "Scenes" }).click();

  await expect(page.getByLabel("Active scene")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in scene" })).toBeVisible();
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.locator(".scene-viewport.show-authoring-grid")).toBeVisible();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("img", { name: "Scene minimap" })).toBeVisible();
  await page.getByRole("button", { name: "Overlays", exact: true }).click();
  await expect(page.locator(".scene-viewport.hide-editor-overlays")).toBeVisible();

  await page.reload();
  await page.locator(".workspace-tabs button").filter({ hasText: "Scenes" }).click();
  await expect(page.locator(".scene-viewport.show-authoring-grid.hide-editor-overlays")).toBeVisible();
  await expect(page.getByRole("img", { name: "Scene minimap" })).toBeVisible();
});
