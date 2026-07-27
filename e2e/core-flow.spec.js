import { expect, test } from "@playwright/test";

async function startPractice(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始今天的探险" }).click();
  await expect(page.locator("#typing-target-panel")).toBeVisible();
}

async function typeCurrentTarget(page) {
  const displayed = (await page.locator("#target-sequence .is-current").first().textContent())?.trim();
  const key = displayed === "·" ? " " : displayed;
  expect(key).toBeTruthy();
  await page.keyboard.press(key);
}

// Day 1 with the standard plan: warmup (3 short drills) + star-scout (3 prompts),
// then the first rest break appears. Keys during rest are ignored, so overshooting is safe.
async function completeStagesUntilRest(page) {
  for (let presses = 0; presses < 80; presses += 1) {
    if (await page.locator(".rest-dialog").isVisible().catch(() => false)) return;
    await typeCurrentTarget(page);
  }
  throw new Error("rest break never appeared after 80 key presses");
}

async function readProfile(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("typing-adventure:profile")));
}

test("completing half of the stages earns the session credit", async ({ page }) => {
  await startPractice(page);
  await completeStagesUntilRest(page);

  await page.getByRole("button", { name: "继续出发" }).click();
  await expect(page.locator("#balloon-arena")).toBeVisible();
  await page.getByRole("button", { name: "结束本次任务" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/降落|探险完成/);
  const stored = await readProfile(page);
  expect(stored.completedSessions).toBe(1);
  expect(stored.history[0].counted).toBe(true);
  expect(stored.history[0].completedStages).toBe(2);
});

test("stopping early records a warmup without advancing the course", async ({ page }) => {
  await startPractice(page);
  await typeCurrentTarget(page);
  await page.getByRole("button", { name: "结束本次任务" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("热身");
  const stored = await readProfile(page);
  expect(stored.completedSessions).toBe(0);
  expect(stored.history.length).toBe(1);
  expect(stored.history[0].counted).toBe(false);
});

test("retry repeats the lesson without recording again", async ({ page }) => {
  await startPractice(page);
  await typeCurrentTarget(page);
  await page.getByRole("button", { name: "结束本次任务" }).click();
  await page.getByRole("button", { name: "再飞一次" }).click();

  await expect(page.locator(".lesson-overline")).toContainText("SESSION 1 / 2");
  const stored = await readProfile(page);
  expect(stored.completedSessions).toBe(0);
  expect(stored.history.length).toBe(1);
});

test("continue after a counted session starts the next formal session", async ({ page }) => {
  await startPractice(page);
  await completeStagesUntilRest(page);
  await page.getByRole("button", { name: "继续出发" }).click();
  await page.getByRole("button", { name: "结束本次任务" }).click();
  await page.getByRole("button", { name: "继续下一站" }).click();

  await expect(page.locator(".lesson-overline")).toContainText("SESSION 2 / 2");
});

test("leaving early keeps a partial record", async ({ page }) => {
  await startPractice(page);
  await typeCurrentTarget(page);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "返回课程首页" }).click();

  await expect(page.getByRole("button", { name: "开始今天的探险" })).toBeVisible();
  const stored = await readProfile(page);
  expect(stored.completedSessions).toBe(0);
  expect(stored.history.length).toBe(1);
  expect(stored.history[0].counted).toBe(false);
});

test("cancelled exit keeps the current practice", async ({ page }) => {
  await startPractice(page);
  await typeCurrentTarget(page);

  page.once("dialog", async (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "返回课程首页" }).click();
  await expect(page.locator("#typing-target-panel")).toBeVisible();
});
