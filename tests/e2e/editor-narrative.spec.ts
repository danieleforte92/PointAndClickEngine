import { expect, test } from "@playwright/test";
import { installEditorMock } from "./editor-fixture";

test("renders and keyboard-selects every built-in narrative node family", async ({ page }) => {
  await installEditorMock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".workspace-tabs button").filter({ hasText: "Narrative" }).click();

  const graph = page.getByLabel("Narrative graph Complete graph fixture");
  await expect(graph).toBeVisible();
  const nodes = graph.locator(".react-flow__node");
  await expect(nodes).toHaveCount(10);
  for (const label of [
    "Dialogue line",
    "Set flag",
    "Change scene",
    "Choice",
    "Condition",
    "Sub-flow",
    "Inventory",
    "Wait",
    "Presentation cue",
    "End"
  ]) {
    await expect(graph.getByText(label, { exact: true })).toBeAttached();
  }

  const waitNode = nodes.filter({ hasText: "Wait" });
  await waitNode.focus();
  await page.keyboard.press("Enter");
  await expect(waitNode).toHaveClass(/selected/);
  await expect(page.locator(".flow-nodes .flow-node-card")).toHaveCount(1);
  await expect(page.locator(".flow-nodes .flow-node-card .flow-node-header > strong")).toHaveText("wait");
  await expect(graph.getByRole("button", { name: "Auto layout" })).toBeVisible();
});
