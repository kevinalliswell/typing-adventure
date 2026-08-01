import { expect, test } from "@playwright/test";

const STORAGE_KEY = "typing-adventure:profile";
const DRAFT_KEY = "typing-adventure:session-draft";

async function startPractice(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始今天的探险" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function pressCurrentCharacter(page) {
  const current = page.locator("#target-sequence .is-current");
  await expect(current).toBeVisible();
  const displayed = await current.textContent();
  await page.keyboard.press(displayed === "·" ? "Space" : displayed);
  return displayed === "·" ? "space" : displayed.toLowerCase();
}

async function shootVisibleBalloon(page) {
  const balloon = page.locator(".falling-balloon:not(.is-exploding) b").first();
  await expect(balloon).toBeVisible({ timeout: 10000 });
  await page.keyboard.press((await balloon.textContent()).toLowerCase());
}

async function clearCurrentStation(page) {
  const count = page.locator("#activity-count");
  const countBefore = await count.textContent();
  const stationBefore = Number(countBefore.match(/第 (\d+) 站/)?.[1]);
  const activity = await page.locator("#activity-title").textContent();

  if (activity === "气球防线") {
    for (let hits = 0; hits < 8; hits += 1) {
      const currentStation = Number((await count.textContent()).match(/第 (\d+) 站/)?.[1]);
      if (currentStation !== stationBefore) break;
      await shootVisibleBalloon(page);
    }
  } else {
    for (let characters = 0; characters < 40; characters += 1) {
      if (await page.locator(".result-shell").count()) break;
      if ((await count.textContent()) !== countBefore) break;
      await pressCurrentCharacter(page);
    }
  }

  await page.waitForFunction((previousStation) => {
    const result = document.querySelector(".result-shell");
    const currentCount = document.querySelector("#activity-count")?.textContent ?? "";
    const currentStation = Number(currentCount.match(/第 (\d+) 站/)?.[1]);
    return Boolean(result) || currentStation !== previousStation;
  }, stationBefore);
}

async function completeThreeGates(page) {
  const activities = new Set();
  for (let stations = 0; stations < 12; stations += 1) {
    if (await page.locator(".result-shell").count()) break;
    const activity = await page.locator("#activity-title").textContent();
    activities.add(activity);
    await clearCurrentStation(page);
  }
  await expect(page.locator(".result-shell--complete")).toBeVisible();
  return activities;
}

async function storedProfile(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

test("one correct key and an early finish save practice without advancing", async ({ page }) => {
  await startPractice(page);
  await pressCurrentCharacter(page);
  await expect(page.locator("#accuracy-value")).toHaveText("100%");
  await page.getByRole("button", { name: "结束并保存本次练习" }).click();

  await expect(page.locator(".result-shell--incomplete")).toBeVisible();
  await expect(page.getByRole("button", { name: "继续下一站" })).toHaveCount(0);
  expect((await storedProfile(page)).completedSessions).toBe(0);
});

for (const minutes of [10, 15]) {
  test(`parent settings persist a ${minutes}-minute maximum for the next session`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "打开家长设置" }).click();
    await expect(page.getByRole("dialog", { name: "家长设置" })).toBeVisible();
    await page.getByRole("button", { name: `最长时长 ${minutes} 分钟` }).click();
    await page.getByRole("button", { name: "保存设置" }).click();

    await page.reload();
    await page.getByRole("button", { name: "打开家长设置" }).click();
    await expect(page.getByRole("button", { name: `最长时长 ${minutes} 分钟` })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "取消" }).click();
    await page.getByRole("button", { name: "开始今天的探险" }).click();
    await expect(page.locator("#timer-value")).toHaveText(`${String(minutes).padStart(2, "0")}:00`);
  });
}

test("a new child starts with a five-minute maximum", async ({ page }) => {
  await startPractice(page);
  await expect(page.locator("#timer-value")).toHaveText("05:00");
});

test("a zero-input timeout saves an incomplete result without advancing", async ({ page }) => {
  await page.addInitScript((draftKey) => {
    sessionStorage.setItem(draftKey, JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      plan: { dayNumber: 1, sessionNumber: 1 },
      countsTowardProgress: true,
      state: {
        difficultyId: "gentle",
        prompt: "fjfjfj",
        activityIndex: 0,
        completedPrompts: 0,
        correct: 0,
        errors: 0,
        total: 0,
        remainingSeconds: 0.1,
      },
    }));
  }, DRAFT_KEY);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");

  await expect(page.locator(".result-shell--incomplete")).toBeVisible({ timeout: 3000 });
  await expect(page.locator(".result-message")).toContainText("时间到了");
  expect((await storedProfile(page)).completedSessions).toBe(0);
});

test("a legacy draft uses the current parent duration and caps its remaining time", async ({ page }) => {
  await page.addInitScript(({ storageKey, draftKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      completedSessions: 0,
      difficultyId: "gentle",
      sessionMinutes: 10,
      audio: { effectsEnabled: false, voiceEnabled: false, volume: 0.6 },
      keyStats: {},
      history: [],
    }));
    sessionStorage.setItem(draftKey, JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      plan: { dayNumber: 1, sessionNumber: 1 },
      countsTowardProgress: true,
      state: {
        difficultyId: "gentle",
        prompt: "fjfjfj",
        activityIndex: 0,
        completedPrompts: 0,
        remainingSeconds: 1200,
      },
    }));
  }, { storageKey: STORAGE_KEY, draftKey: DRAFT_KEY });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");

  await expect(page.locator("#timer-value")).toHaveText("10:00");
});

test("three gates rotate all activities and advance formal progress once", async ({ page }) => {
  await startPractice(page);
  const activities = await completeThreeGates(page);

  expect([...activities]).toEqual(["找星星", "气球防线", "小火车", "密码门", "火箭冲刺"]);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("三关完成");
  expect((await storedProfile(page)).completedSessions).toBe(1);
});

test("a missed balloon becomes an error in the live and saved key stats", async ({ page }) => {
  await startPractice(page);
  await clearCurrentStation(page);
  await clearCurrentStation(page);
  await expect(page.locator("#activity-title")).toHaveText("气球防线");

  await expect(page.locator(".balloon-field__stats")).toContainText(/漏掉 [1-9]/, { timeout: 12000 });
  await expect(page.locator("#accuracy-value")).not.toHaveText("100%");
  const savedErrors = Object.values((await storedProfile(page)).keyStats)
    .reduce((total, stats) => total + stats.errors, 0);
  expect(savedErrors).toBeGreaterThanOrEqual(1);
});

test("a balloon station waits for eight hits before advancing", async ({ page }) => {
  await startPractice(page);
  await clearCurrentStation(page);
  await clearCurrentStation(page);
  await expect(page.locator("#activity-title")).toHaveText("气球防线");
  const station = page.locator("#activity-count");
  await expect(station).toHaveText("第 3 站 · 0 / 8");

  await shootVisibleBalloon(page);
  await expect(station).toHaveText("第 3 站 · 1 / 8");
  await expect(page.locator(".balloon-field__stats")).toContainText("本小站 1 / 8");
  await page.getByRole("button", { name: "暂停练习" }).click();
  await page.getByRole("button", { name: "继续飞行" }).click();
  await expect(station).toHaveText("第 3 站 · 1 / 8");

  for (let hit = 1; hit < 8; hit += 1) await shootVisibleBalloon(page);
  await expect(station).toContainText("第 4 站");
});

test("retry repeats the completed lesson without advancing progress again", async ({ page }) => {
  await startPractice(page);
  const lessonBefore = await page.locator(".lesson-overline").textContent();
  await completeThreeGates(page);
  await page.getByRole("button", { name: "再飞一次" }).click();

  await expect(page.locator(".lesson-overline")).toHaveText(lessonBefore);
  expect((await storedProfile(page)).completedSessions).toBe(1);
});

test("continue starts the next formal session", async ({ page }) => {
  await startPractice(page);
  await completeThreeGates(page);
  await page.getByRole("button", { name: "继续下一站" }).click();

  await expect(page.locator(".lesson-overline")).toContainText("SESSION 2 / 2");
});

test("cancelled exit keeps the current practice", async ({ page }) => {
  await startPractice(page);
  const practicedKey = await pressCurrentCharacter(page);
  expect((await storedProfile(page)).keyStats[practicedKey].hits).toBe(1);

  page.once("dialog", async (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "返回课程首页" }).click();
  await expect(page.locator("#typing-target-panel")).toBeVisible();
});

test("rocket difficulty reaches a 96 percent challenge with hidden key hints", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /键盘火箭手 · 96%/ }).click();
  await page.getByRole("button", { name: "开始今天的探险" }).click();

  for (let stations = 0; stations < 8; stations += 1) await clearCurrentStation(page);

  await expect(page.locator("#activity-title")).toHaveText("火箭冲刺");
  await expect(page.locator("#gate-accuracy")).toContainText("/ 96%");
  await expect(page.locator("#target-chip")).toHaveText("自己找");
  await expect(page.locator(".keyboard-key.is-target")).toHaveCount(0);
});

test("late lessons show the complete punctuation keyboard", async ({ page }) => {
  await page.addInitScript(({ key, profile }) => {
    localStorage.setItem(key, JSON.stringify(profile));
  }, {
    key: STORAGE_KEY,
    profile: {
      version: 1,
      completedSessions: 68,
      totalSeconds: 0,
      difficultyId: "gentle",
      audio: { effectsEnabled: false, voiceEnabled: false, volume: 0.6 },
      keyStats: {},
      history: [],
    },
  });
  await startPractice(page);

  for (const key of ["g", "h", ",", ".", "/", "1", "shift"]) {
    await expect(page.locator(`[data-key="${key}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-key="/"]')).toHaveText("/ ?");
  await expect(page.locator('[data-key="1"]')).toHaveText("1 !");
});
