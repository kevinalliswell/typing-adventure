import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
];

for (const viewport of VIEWPORTS) {
  test(`home and practice fit a ${viewport.width}px viewport without console errors`, async ({ page }) => {
    const browserIssues = [];
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type())) browserIssues.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));

    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("小小键盘星探");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    if (process.env.VISUAL_AUDIT === "1") {
      await mkdir("output/visual-audit", { recursive: true });
      await page.screenshot({ path: `output/visual-audit/home-${viewport.width}.png`, fullPage: true });
    }

    await page.getByRole("button", { name: "开始今天的探险" }).click();
    await expect(page.getByRole("button", { name: "暂停练习" })).toBeVisible();
    expect(await page.evaluate(() => {
      const pause = document.querySelector('[data-action="pause"]');
      const bounds = pause?.getBoundingClientRect();
      return Boolean(bounds && bounds.left >= 0 && bounds.right <= window.innerWidth);
    })).toBe(true);
    await expect(page.locator(".gate-progress")).toBeVisible();
    await expect(page.locator("#typing-target-panel")).toBeVisible();
    await expect(page.locator(".keyboard-key")).toHaveCount(42);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(browserIssues).toEqual([]);

    if (process.env.VISUAL_AUDIT === "1") {
      await mkdir("output/visual-audit", { recursive: true });
      await page.screenshot({ path: `output/visual-audit/practice-${viewport.width}.png`, fullPage: true });
    }
  });
}
