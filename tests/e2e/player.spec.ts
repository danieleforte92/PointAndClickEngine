import { expect, test } from "@playwright/test";

test("plays the light-verb inventory loop end to end", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "The Isle of Echoes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record the full point-and-click loop in one take." })).toBeVisible();
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

  await page.getByRole("button", { name: "look" }).click();
  await clickCanvas(910, 440);

  const dialogue = page.locator(".dialogue-card");
  await expect(dialogue).toContainText("The tavern door is warm");
  await expect(page.locator(".demo-progress strong")).toContainText("1/3");
  await expect(page.locator(".story-signal").filter({ hasText: "Door inspected" })).toContainText("Ready");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText(
    "hotspot look: The Lantern & Gull"
  );
  await dialogue.click();
  await expect(dialogue).toHaveCount(0);

  await page.getByRole("button", { name: "use" }).click();
  await clickCanvas(335, 590);
  await expect(dialogue).toContainText("A rusty hook.");
  await dialogue.click();
  await expect(page.getByRole("button", { name: "Rusty Hook" })).toBeVisible();
  await expect(page.locator(".demo-progress strong")).toContainText("2/3");
  await expect(page.locator(".story-signal").filter({ hasText: "Hook collected" })).toContainText("Ready");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText(
    "pickup collected: Rusty Hook"
  );
  await page.getByRole("button", { name: "Rusty Hook" }).click();

  await clickCanvas(910, 440);
  await expect(dialogue).toContainText("The hook catches the latch.");
  await expect(page.locator(".demo-progress strong")).toContainText("3/3");
  await expect(page.locator(".story-signal").filter({ hasText: "Latch opened" })).toContainText("Ready");
  await expect(page.getByRole("complementary", { name: "Recent runtime events" })).toContainText(
    "flag set: tavern.hook-used = true"
  );
  await dialogue.click();
  await expect(dialogue).toHaveCount(0);

  await page.getByRole("button", { name: "walk" }).click();
  await clickCanvas(580, 610);
  await expect(page.locator(".event-readout").nth(1)).not.toContainText("510, 590");
  await expect(page.locator(".event-readout").first()).toContainText("character/moved");
});
