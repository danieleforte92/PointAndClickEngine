import { expect, test } from "@playwright/test";
import { installEditorMock } from "./editor-fixture";

test("opens Test Lab, compares Browser replay, and restores authoring", async ({ page }) => {
  await installEditorMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/");

  await page.getByRole("button", { name: "Play Project" }).click();
  await expect(page.getByText("Test Lab", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Point & Click runtime preview")).toBeVisible();
  const embeddedFrame = page.frames().find((frame) => frame !== page.mainFrame());
  await embeddedFrame?.setContent(`
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: #dbe9e7; background: radial-gradient(circle at 60% 35%, #28566a, #071118 65%); font: 16px system-ui; }
      main { width: min(72%, 680px); padding: 36px; border: 1px solid #5b8b91; border-radius: 12px; background: rgba(5, 18, 25, .82); box-shadow: 0 24px 80px #0009; }
      small { color: #d9a561; letter-spacing: .18em; text-transform: uppercase; }
      h1 { margin: 12px 0; font: 34px Georgia, serif; }
      p { color: #9eb9bc; line-height: 1.6; }
    </style>
    <main><small>Embedded runtime</small><h1>Clean Adventure</h1><p>The player stays isolated from authoring controls while Test Lab records logical actions and runtime snapshots.</p></main>
  `);

  await page.getByRole("button", { name: "Browser", exact: true }).click();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText("No divergence", { exact: true })).toBeVisible();

  const screenshotPath = process.env.EDITOR_TEST_LAB_SCREENSHOT_PATH;
  if (screenshotPath) await page.screenshot({ path: screenshotPath });

  const browserPreviewCount = await page.evaluate(() => {
    return (window as typeof window & { __pointClickBrowserPreviewCount?: number })
      .__pointClickBrowserPreviewCount ?? 0;
  });
  expect(browserPreviewCount).toBe(1);

  await page.getByRole("button", { name: "Close Test Lab" }).click();
  await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await expect(page.getByText("Project command center", { exact: true })).toBeVisible();
});

test("renders the selected scene in the embedded draft preview", async ({ page }) => {
  await installEditorMock(page, { embeddedPreviewBaseUrl: "http://127.0.0.1:5173/" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/");

  await page.locator(".workspace-tabs button").filter({ hasText: "Scenes" }).click();
  await page.getByLabel("Scene background color").fill("#35516b");
  await page.getByRole("button", { name: "Draft Preview" }).click();
  await expect(page.getByText("Test Lab", { exact: true })).toBeVisible();

  const previewFrame = page.frameLocator('iframe[title="Point & Click runtime preview"]');
  await expect(previewFrame.locator(".stage-host canvas")).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as typeof window & {
      __pointClickPreviewSceneBackground?: string;
      __pointClickPreviewSceneId?: string;
    };
    return {
      sceneBackground: testWindow.__pointClickPreviewSceneBackground,
      sceneId: testWindow.__pointClickPreviewSceneId,
    };
  })).toEqual({ sceneBackground: "#35516b", sceneId: "new-scene" });
});

test("resizes, collapses, and restores local panel preferences", async ({ page }) => {
  await installEditorMock(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("http://127.0.0.1:5174/");

  const grid = page.locator(".workspace-grid");
  const projectResize = page.getByRole("separator", { name: "Resize project panel" });
  const columnsBefore = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  await projectResize.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).not.toBe(columnsBefore);

  await page.getByRole("button", { name: "Collapse project panel" }).click();
  await expect(page.getByRole("button", { name: "Open project panel" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Open project panel" })).toBeVisible();
  await page.getByRole("button", { name: "Open project panel" }).click();
  await expect(page.getByRole("separator", { name: "Resize project panel" })).toBeVisible();

  await page.getByRole("button", { name: "Collapse inspector panel" }).click();
  await expect(page.getByRole("button", { name: "Open inspector panel" })).toBeVisible();
});
