import { expect, test } from "@playwright/test";
import { installEditorMock } from "./editor-fixture";

test("covers visual authoring workspaces, persistence surfaces, and accessibility", async ({ page }) => {
  await installEditorMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/");

  const workspaces = page.getByRole("navigation", { name: "Workspaces" });
  await workspaces.getByRole("button", { name: "Scenes", exact: true }).click();
  await expect(page.locator(".scene-navigator-heading")).toBeVisible();
  await expect(page.getByLabel("Search scenes")).toBeVisible();
  await expect(page.getByLabel("Scene view preferences").getByRole("button", { name: "Fit", exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Resource dock", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Resize resource dock")).toHaveAttribute("role", "separator");

  await page.getByRole("tab", { name: "Livelli", exact: true }).click();
  await expect(page.locator(".scene-levels-panel")).toBeVisible();
  await expect(page.locator(".scene-levels-panel .scene-level-row").first()).toBeVisible();

  await workspaces.getByRole("button", { name: "Flussi", exact: true }).click();
  await expect(page.getByLabel("Flows workspace")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Gameplay", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Gameplay graph")).toBeVisible();
  await expect(page.getByRole("button", { name: /Link from/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Link from/ }).first().click();
  await expect(page.getByLabel("Guided transition wizard")).toBeVisible();
  await expect(page.getByLabel("Transition flow")).toBeVisible();

  await page.getByRole("tab", { name: "Narrative", exact: true }).click();
  await expect(page.getByLabel("Node palette")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Dialogue line", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto layout", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Duplicate selected", exact: true })).toBeVisible();

  await expect(page).toHaveScreenshot("visual-authoring-flows.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.003
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page).toHaveScreenshot("visual-authoring-flows-1920.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.003
  });

  await workspaces.getByRole("button", { name: "Project", exact: true }).click();
  const accessibilityIssues = await page.locator("button").evaluateAll((buttons) => buttons.flatMap((button) => {
    const text = button.textContent?.trim() ?? "";
    const label = button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "";
    return text || label ? [] : [button.outerHTML.slice(0, 160)];
  }));
  expect(accessibilityIssues, "every button needs visible text or an accessible name").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keeps the authoring shell inside a narrow desktop viewport", async ({ page }) => {
  await installEditorMock(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("http://127.0.0.1:5174/");

  await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator(".workspace-grid")).toBeVisible();
});
