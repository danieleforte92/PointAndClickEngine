import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { installEditorMock } from "./editor-fixture";

async function captureBaseline(page: Page, name: string) {
  const directory = process.env.BASELINE_SCREENSHOT_DIR;
  if (!directory) return;

  await page.locator(".workspace-grid").waitFor({ state: "visible" });
  await page.waitForTimeout(100);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: path.join(directory, `${name}.png`)
  });
}

async function assertBaseline(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.003
  });
}

test("characterizes the editor navigation and authoring handoffs", async ({ page }) => {
  test.setTimeout(90_000);
  await installEditorMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/");

  const workspaces = page.getByRole("navigation", { name: "Workspaces" });
  await expect(workspaces).toBeVisible();
  await captureBaseline(page, "01-overview");
  await assertBaseline(page, "01-overview");

  for (const label of ["Scenes", "Narrative", "Assets", "AI Studio", "Build"]) {
    const tab = workspaces.getByRole("button", { name: label, exact: true });
    await tab.click();
    await expect(tab).toHaveClass(/active/);
  }

  await workspaces.getByRole("button", { name: "Project", exact: true }).click();
  const projectStructure = page.locator(".project-structure-card");
  await projectStructure.getByRole("button", { name: /Narrative/ }).click();
  await expect(workspaces.getByRole("button", { name: "Narrative", exact: true })).toHaveClass(/active/);
  await expect(page.getByText("Scene-linked flows", { exact: true })).toBeVisible();

  await workspaces.getByRole("button", { name: "Project", exact: true }).click();
  await projectStructure.getByRole("button", { name: /Build/ }).click();
  await expect(workspaces.getByRole("button", { name: "Build", exact: true })).toHaveClass(/active/);
  await expect(page.getByText("Project validation", { exact: true })).toBeVisible();
  await captureBaseline(page, "02-build");
  await assertBaseline(page, "02-build");

  await workspaces.getByRole("button", { name: "Scenes", exact: true }).click();
  const activeScene = page.getByLabel("Active scene");
  await expect(activeScene).toBeVisible();
  const initialScene = await activeScene.inputValue();
  await activeScene.selectOption(initialScene);
  await expect(activeScene).toHaveValue(initialScene);
  await expect(page.getByRole("button", { name: "Zoom in scene" })).toBeVisible();

  await workspaces.getByRole("button", { name: "AI Studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Give the scene a clear visual point of view." })).toBeVisible();
  await page.getByRole("button", { name: "Generate Targets" }).click();
  await expect(page.getByRole("heading", { name: "Choose the game piece and inspect its project context." })).toBeVisible();
  await page.locator(".ai-target-list button").first().click();
  await page.getByRole("button", { name: "Continue to Recipe" }).click();
  await page.getByRole("navigation", { name: "AI Studio steps" }).getByRole("button", { name: /Generate/ }).click();
  await expect(page.getByRole("heading", { name: "Create candidates without changing the project." })).toBeVisible();
  await page.getByLabel("Image provider", { exact: true }).selectOption("openai-image");
  await page.getByRole("button", { name: "Generate Candidates" }).click();
  await expect(page.getByText("Temporary candidate", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply to Project" }).click();
  await expect.poll(() => page.evaluate(() => {
    return (window as typeof window & { __pointClickAppliedCandidateCount?: number })
      .__pointClickAppliedCandidateCount ?? 0;
  })).toBe(1);
  await workspaces.getByRole("button", { name: "Assets", exact: true }).click();
  await expect(workspaces.getByRole("button", { name: "Assets", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".asset-studio-shell")).toBeVisible();
  await captureBaseline(page, "03-ai-assets");
  await assertBaseline(page, "03-ai-assets");

  await page.getByRole("button", { name: "Play Project" }).click();
  await expect(page.getByText("Test Lab", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Point & Click runtime preview")).toBeVisible();
  await page.getByRole("button", { name: "Close Test Lab" }).click();
  await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await expect(workspaces.getByRole("button", { name: "Assets", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".asset-studio-shell")).toBeVisible();
  await captureBaseline(page, "04-test-lab-return");
  await assertBaseline(page, "04-test-lab-return");
});
