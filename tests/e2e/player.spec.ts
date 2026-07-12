import { expect, test } from "@playwright/test";

test("plays the showcase light-verb inventory loop end to end", async ({ page }) => {
  await page.goto("/?mode=showcase");

  await expect(page.getByRole("heading", { name: "The Isle of Echoes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record the full point-and-click loop in one take." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Showcase" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Capture" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".demo-progress strong")).toContainText("0/3");
  await expect(page.getByRole("region", { name: "Current story state" })).toContainText("Door inspected");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText("game started");
  await expect(page.locator(".event-readout").nth(2)).toContainText("1");

  const canvas = page.locator(".stage-host canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Canvas has no bounding box");
  const clickCanvas = async (x: number, y: number) => {
    await canvas.click({
      force: true,
      position: {
        x: bounds.width * (x / 1280),
        y: bounds.height * (y / 720)
      }
    });
  };

  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: "look" })).toHaveClass(/active/);
  await clickCanvas(910, 440);

  const dialogue = page.locator(".dialogue-card");
  await expect(dialogue).toContainText("The tavern door is warm");
  await expect(dialogue.locator(".speaker")).toContainText("Mara");
  await expect(page.locator(".demo-progress strong")).toContainText("1/3");
  await expect(page.locator(".story-signal").filter({ hasText: "Door inspected" })).toContainText("Ready");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText(
    "hotspot look: The Lantern & Gull"
  );
  await page.keyboard.press("Space");
  await expect(dialogue).toHaveCount(0);

  await page.keyboard.press("3");
  await expect(page.getByRole("button", { name: "use" })).toHaveClass(/active/);
  await clickCanvas(335, 590);
  await expect(dialogue).toContainText("A rusty hook.");
  await expect(dialogue.locator(".speaker")).toContainText("Mara");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Rusty Hook" })).toBeVisible();
  await expect(page.locator(".demo-progress strong")).toContainText("2/3");
  await expect(page.locator(".story-signal").filter({ hasText: "Hook collected" })).toContainText("Ready");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText(
    "pickup collected: Rusty Hook"
  );
  await page.getByRole("button", { name: "Rusty Hook" }).click();

  await clickCanvas(910, 440);
  await expect(dialogue).toContainText("The hook catches the latch.");
  await expect(dialogue.locator(".speaker")).toContainText("Mara");
  await expect(page.locator(".demo-progress strong")).toContainText("3/3");
  await expect(page.locator(".story-signal").filter({ hasText: "Latch opened" })).toContainText("Ready");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText(
    "flag set: tavern.hook-used = true"
  );
  await page.keyboard.press("Space");
  await expect(dialogue).toHaveCount(0);

  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: "walk" })).toHaveClass(/active/);
  await clickCanvas(580, 610);
  await expect(page.locator(".event-readout").nth(1)).not.toContainText("510, 590");
  await expect(page.locator(".event-readout").first()).toContainText("character moved: 580, 610");

  await page.keyboard.press("c");
  await expect(page.getByRole("button", { name: "Capture" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Showcase" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Capture mode summary" })).toContainText("Loop progress 3/3");
  await expect(page.getByRole("region", { name: "Sample demo checklist" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Current sample loop" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Current story state" })).toHaveCount(0);

  const capturePath = process.env.CAPTURE_SAMPLE_SCREENSHOT_PATH;
  if (capturePath) {
    await page.screenshot({
      path: capturePath,
      fullPage: true
    });
  }
});

test("keeps the player surface usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator(".stage-host canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "walk" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Inventory" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sample demo checklist" })).toHaveCount(0);

  const stage = page.locator(".stage-frame");
  const canvas = page.locator(".stage-host canvas");
  const stageBounds = await stage.boundingBox();
  const canvasBounds = await canvas.boundingBox();
  if (!stageBounds || !canvasBounds) throw new Error("Play surface has no layout bounds");
  expect(canvasBounds.width).toBeLessThanOrEqual(stageBounds.width + 1);
  expect(canvasBounds.height).toBeLessThanOrEqual(stageBounds.height + 1);
  expect(canvasBounds.width).toBeGreaterThan(0);
  expect(canvasBounds.height).toBeGreaterThan(0);
  expect(canvasBounds.width / canvasBounds.height).toBeCloseTo(16 / 9, 1);
  const canvasBuffer = await canvas.evaluate((node) => ({ width: node.width, height: node.height }));
  expect(canvasBuffer.width).toBeLessThan(1280);
  expect(canvasBuffer.height).toBeLessThan(720);

  await page.goto("/?mode=showcase");
  await expect(page.getByRole("button", { name: "Showcase" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Capture" }).click();
  await expect(page.getByRole("button", { name: "Capture" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Capture mode summary" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("keeps the legacy guide query as a showcase alias", async ({ page }) => {
  await page.goto("/?mode=guide");

  await expect(page.getByRole("button", { name: "Showcase" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Sample demo checklist" })).toBeVisible();
});
