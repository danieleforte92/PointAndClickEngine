import { expect, test } from "@playwright/test";
import { installEditorMock } from "./editor-fixture";

test("guides AI Studio from brief to explicit review", async ({ page }) => {
  await installEditorMock(page);
  await page.goto("http://127.0.0.1:5174/");

  const aiWorkspaceButton = page.locator(".workspace-tabs button").filter({ hasText: "AI Studio" });
  await expect(aiWorkspaceButton).toBeVisible();
  await aiWorkspaceButton.click();

  await expect(page.getByRole("heading", { name: "Build art direction, then approve the output." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "AI Studio steps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Give the scene a clear visual point of view." })).toBeVisible();
  await expect(page.getByText("2. Targets", { exact: true })).toBeVisible();
  await expect(page.getByText("2. Context", { exact: true })).toHaveCount(0);
  await expect(page.locator(".ai-advanced-section")).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Prompt provider", { exact: true })).toHaveValue("mock");
  await expect(page.getByRole("button", { name: "Configure prompt provider" })).toBeVisible();

  await page.getByRole("button", { name: "Generate Targets" }).click();
  await expect(page.getByRole("heading", { name: "Choose the game pieces that need artwork." })).toBeVisible();
  await expect(page.locator(".ai-target-list button").first()).toBeVisible({ timeout: 10_000 });

  await page.locator(".ai-target-list button").first().click();
  await page.getByRole("button", { name: "Continue to Generate" }).click();
  await expect(page.getByRole("heading", { name: "Prepare one asset without losing the project context." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Advanced Setup" })).toBeVisible();

  const aiWorkspace = page.locator(".ai-workspace");
  await expect(aiWorkspace).toHaveCSS("overflow-y", "auto");
  await aiWorkspace.evaluate((element) => element.scrollTo({ top: 0, behavior: "auto" }));
  const scrollTopBeforeOpen = await aiWorkspace.evaluate((element) => element.scrollTop);
  await page.getByRole("button", { name: "Open Advanced Setup" }).click();
  await expect(page.locator(".ai-advanced-section")).toHaveAttribute("open", "");
  await expect
    .poll(() => aiWorkspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(scrollTopBeforeOpen);
  const scrollMetrics = await aiWorkspace.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  const advancedOutput = page.locator(".ai-advanced-section .prompt-output-card");
  await aiWorkspace.evaluate((element) => element.scrollTo({ top: 0, behavior: "auto" }));
  await aiWorkspace.hover();
  const scrollTopBeforeWheel = await aiWorkspace.evaluate((element) => element.scrollTop);
  await page.mouse.wheel(0, 560);
  await expect
    .poll(() => aiWorkspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(scrollTopBeforeWheel);
  await advancedOutput.scrollIntoViewIfNeeded();
  await expect(advancedOutput).toBeVisible();
  const outputBounds = await advancedOutput.boundingBox();
  const workspaceBounds = await aiWorkspace.boundingBox();
  if (!outputBounds || !workspaceBounds) throw new Error("AI Studio candidate output has no layout bounds");
  expect(outputBounds.y).toBeGreaterThanOrEqual(workspaceBounds.y - 1);
  expect(outputBounds.y + outputBounds.height).toBeLessThanOrEqual(
    workspaceBounds.y + workspaceBounds.height + 1
  );

  const screenshotPath = process.env.EDITOR_AI_SCREENSHOT_PATH;
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath });
  }

  await page.getByRole("button", { name: /Review & Apply/ }).click();
  await expect(page.getByRole("heading", { name: "Approve the draft before it changes the project." })).toBeVisible();
  const reviewStep = page
    .locator(".ai-guided-step")
    .filter({ hasText: "Approve the draft before it changes the project." });
  await expect(reviewStep.getByText("Readable scene background for the editor UX test.")).toBeVisible();
  await expect(reviewStep.getByRole("button", { name: "Open Advanced" })).toBeVisible();
  await aiWorkspace.evaluate((element) => element.scrollTo({ top: 0, behavior: "auto" }));
  const scrollTopBeforeReviewOpen = await aiWorkspace.evaluate((element) => element.scrollTop);
  await reviewStep.getByRole("button", { name: "Open Advanced" }).click();
  await expect
    .poll(() => aiWorkspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(scrollTopBeforeReviewOpen);
  await expect(
    reviewStep.getByRole("button", { name: "Save Approved Pack" })
  ).toBeVisible();
  await expect(page.getByText("Nothing has been written to the project.")).toHaveCount(0);

});

test("configures prompt and image providers from their gear modals", async ({ page }) => {
  await installEditorMock(page);
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".workspace-tabs button").filter({ hasText: "AI Studio" }).click();

  const promptProvider = page.getByLabel("Prompt provider", { exact: true });
  await promptProvider.selectOption("lmstudio");
  const promptGear = page.getByRole("button", { name: "Configure prompt provider" });
  await promptGear.click();

  const promptDialog = page.getByRole("dialog", { name: "LM Studio local" });
  await expect(promptDialog).toBeVisible();
  await expect(promptDialog.getByLabel("LM Studio base URL")).toHaveValue("http://localhost:1234/v1");
  await promptDialog.getByLabel("LM Studio base URL").fill("http://localhost:1234/v1");
  await promptDialog.getByLabel("Model").fill("qwen-local");
  await promptDialog.getByLabel("Remote provider consent").check();
  await promptDialog.getByRole("button", { name: "Apply" }).click();
  await expect(promptDialog).toBeHidden();
  await expect(promptGear).toBeFocused();

  await page.getByRole("button", { name: "Generate Targets" }).click();
  await expect(page.getByRole("heading", { name: "Choose the game pieces that need artwork." })).toBeVisible();
  const promptRequest = await page.evaluate(() => {
    return (window as typeof window & { __pointClickLastPromptPackRequest?: unknown })
      .__pointClickLastPromptPackRequest;
  });
  expect(promptRequest).toMatchObject({
    allowRemoteProvider: true,
    lmStudioBaseUrl: "http://localhost:1234/v1",
    lmStudioModel: "qwen-local",
    providerId: "lmstudio"
  });

  await page.locator(".ai-target-list button").first().click();
  await page.getByRole("button", { name: "Continue to Generate" }).click();
  const imageProvider = page.getByLabel("Image provider", { exact: true });
  await imageProvider.selectOption("openai-image");
  await expect(page.locator(".ai-guided-summary-grid").getByText("OpenAI image", { exact: true })).toBeVisible();

  const imageGear = page.getByRole("button", { name: "Configure image provider" });
  await imageGear.click();
  const imageDialog = page.getByRole("dialog", { name: "OpenAI image" });
  await expect(imageDialog).toBeVisible();
  await imageDialog.getByLabel("OpenAI image model").fill("gpt-image-test");
  await imageDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(imageGear).toBeFocused();
  await imageGear.click();
  await expect(imageDialog.getByLabel("OpenAI image model")).toHaveValue("gpt-image-2");
  await imageDialog.getByLabel("OpenAI image model").fill("gpt-image-test");
  await imageDialog.getByRole("button", { name: "Apply" }).click();
  await expect(imageGear).toBeFocused();

  await page.getByRole("button", { name: "Generate & Import Asset" }).click();
  const imageRequest = await page.evaluate(() => {
    return (window as typeof window & { __pointClickLastImageRequest?: unknown }).__pointClickLastImageRequest;
  });
  expect(imageRequest).toMatchObject({ providerId: "openai-image" });
});

test("closes provider config with Escape and backdrop while restoring focus", async ({ page }) => {
  await installEditorMock(page);
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".workspace-tabs button").filter({ hasText: "AI Studio" }).click();

  const promptGear = page.getByRole("button", { name: "Configure prompt provider" });
  await promptGear.click();
  await page.keyboard.press("Escape");
  await expect(promptGear).toBeFocused();

  await promptGear.click();
  const backdrop = page.locator(".provider-config-backdrop");
  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(backdrop).toBeHidden();
  await expect(promptGear).toBeFocused();
});
