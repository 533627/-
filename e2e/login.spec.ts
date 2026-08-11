import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const password = "E2ePassword_2026";
const testUsernames = ["e2e_owner", "e2e_employee"];

test.describe.configure({ mode: "serial" });

test.describe("用户名登录和角色工作区", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");

  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl! }),
  });

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.user.deleteMany({
      where: { username: { in: testUsernames } },
    });
    const operationsDepartment = await database.department.upsert({
      where: { code: "OPERATIONS" },
      update: { isActive: true },
      create: { code: "OPERATIONS", name: "运营部" },
    });
    const passwordHash = await hashPassword(password);

    await database.user.create({
      data: testUser({
        username: "e2e_owner",
        name: "测试老板",
        role: "SUPER_ADMIN",
        passwordHash,
      }),
    });
    await database.user.create({
      data: testUser({
        username: "e2e_employee",
        name: "运营助理",
        role: "EMPLOYEE",
        departmentId: operationsDepartment.id,
        passwordHash,
      }),
    });
  });

  test.afterAll(async () => {
    await database.user.deleteMany({
      where: { username: { in: testUsernames } },
    });
    await database.$disconnect();
  });

  test("未登录访问工作台会进入中文登录页", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "登录商序终端" }),
    ).toBeVisible();
    await expect(page.getByLabel("登录账号")).toBeVisible();
    await expect(page.getByLabel("密码")).toBeVisible();
  });

  test("最高管理员可登录、查看管理导航并退出", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("登录账号").fill("e2e_owner");
    await page.getByLabel("密码").fill("wrong-password");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "账号或密码错误" }),
    ).toBeVisible();

    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "登录" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "掌握全公司项目推进" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "账号终端", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "部门管理", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "审计记录", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("员工移动端只显示工作导航且不能直接打开账号终端", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/login");
    await page.getByLabel("登录账号").fill("e2e_employee");
    await page.getByLabel("密码").fill(password);
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "打开菜单" }).click();

    const navigation = page.getByRole("navigation", { name: "主导航" });
    await expect(
      navigation.getByRole("link", { name: "任务待办", exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "账号终端", exact: true }),
    ).toHaveCount(0);
    await page.goto("/accounts");
    await expect(
      page.getByRole("heading", { level: 1, name: "没有找到这个页面" }),
    ).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

function testUser(input: {
  username: string;
  name: string;
  role: "SUPER_ADMIN" | "EMPLOYEE";
  passwordHash: string;
  departmentId?: string;
}) {
  const userId = randomUUID();

  return {
    id: userId,
    name: input.name,
    email: `${input.username}@internal.invalid`,
    emailVerified: true,
    username: input.username,
    displayUsername: input.username,
    role: input.role,
    departmentId: input.departmentId,
    accounts: {
      create: {
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        password: input.passwordHash,
      },
    },
  } as const;
}
