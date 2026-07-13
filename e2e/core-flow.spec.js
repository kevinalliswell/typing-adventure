import { expect, test } from "@playwright/test";

async function startPractice(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始今天的探险" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("home to practice to result persists course progress", async ({ page }) => {
  await startPractice(page);

  const target = page.locator("#target-sequence .is-current");
  const displayed = (await target.textContent())?.trim();
  const key = displayed === "·" ? " " : displayed;
  expect(key).toBeTruthy();

  await page.keyboard.press(key);
  await expect(page.locator("#accuracy-value")).toHaveText("100%");
  await page.getByRole("button", { name: "结束本次任务" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/降落|探险完成/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("typing-adventure:profile")));
  expect(stored.completedSessions).toBe(1);
});

test("retry repeats the completed lesson without advancing progress again", async ({ page }) => {
  await startPractice(page);
  const before = await page.locator(".lesson-overline").textContent();

  const displayed = (await page.locator("#target-sequence .is-current").textContent())?.trim();
  await page.keyboard.press(displayed === "·" ? " " : displayed);
  await page.getByRole("button", { name: "结束本次任务" }).click();
  await page.getByRole("button", { name: "再飞一次" }).click();

  await expect(page.locator(".lesson-overline")).toHaveText(before);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("typing-adventure:profile")));
  expect(stored.completedSessions).toBe(1);
});

test("continue starts the next formal session", async ({ page }) => {
  await startPractice(page);
  const displayed = (await page.locator("#target-sequence .is-current").textContent())?.trim();
  await page.keyboard.press(displayed === "·" ? " " : displayed);
  await page.getByRole("button", { name: "结束本次任务" }).click();
  await page.getByRole("button", { name: "继续下一站" }).click();

  await expect(page.locator(".lesson-overline")).toContainText("SESSION 2 / 2");
});

test("cancelled exit keeps the current practice", async ({ page }) => {
  await startPractice(page);
  const displayed = (await page.locator("#target-sequence .is-current").textContent())?.trim();
  await page.keyboard.press(displayed === "·" ? " " : displayed);

  page.once("dialog", async (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "返回课程首页" }).click();
  await expect(page.locator("#typing-target-panel")).toBeVisible();
});