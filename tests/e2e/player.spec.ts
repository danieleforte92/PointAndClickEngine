import { expect, test } from "@playwright/test";

test("walks, activates a hotspot, and completes its dialogue flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "The Isle of Echoes" })).toBeVisible();
  await expect(page.locator(".event-readout").nth(2)).toContainText("1");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Canvas has no bounding box");

  await page.mouse.click(
    bounds.x + bounds.width * (910 / 1280),
    bounds.y + bounds.height * (440 / 720)
  );

  const dialogue = page.locator(".dialogue-card");
  await expect(dialogue).toContainText("The tavern door is warm");
  await dialogue.click();
  await expect(dialogue).toContainText("Someone inside is playing my song");
  await dialogue.click();
  await expect(dialogue).toHaveCount(0);

  await page.mouse.click(
    bounds.x + bounds.width * (580 / 1280),
    bounds.y + bounds.height * (610 / 720)
  );
  await expect(page.locator(".event-readout").nth(1)).not.toContainText("510, 590");
  await expect(page.locator(".event-readout").first()).toContainText("character/moved");
});
