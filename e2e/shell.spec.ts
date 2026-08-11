import { expect, test } from "@playwright/test";

test("登录页呈现平台身份且没有浏览器控制台错误", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/login");

  await expect(page).toHaveTitle("登录 · 商序终端");
  await expect(
    page.getByRole("heading", { level: 1, name: "登录商序终端" }),
  ).toBeVisible();
  await expect(page.getByText("终端不开放公开注册")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("320 像素登录页没有横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/login");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
