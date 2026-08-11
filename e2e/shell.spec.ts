import { expect, test } from "@playwright/test";

test("首页呈现平台身份与项目闭环", async ({ page }) => {
  const consoleIssues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle("商序终端");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "让每一个电商项目，都有清晰的负责人和下一步。",
    }),
  ).toBeVisible();
  await expect(page.getByText("提交成果并验收")).toBeVisible();
  expect(consoleIssues).toEqual([]);
});

test("未知地址展示可恢复的 404 页面", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");

  await expect(
    page.getByRole("heading", { level: 1, name: "没有找到这个页面" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "返回首页" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("320 像素手机页面没有横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
