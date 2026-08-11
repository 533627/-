import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword, verifyPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const initialPassword = "AccountE2ePassword_2026";
const prefix = `acct_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.describe.configure({ mode: "serial" });

test.describe("账号终端", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");

  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl! }),
  });
  const departmentId = randomUUID();
  const ownerId = randomUUID();
  const operationsAdminId = randomUUID();
  const departmentManagerId = randomUUID();
  const employeeId = randomUUID();
  const ownerUsername = `${prefix}_owner`;
  const operationsUsername = `${prefix}_ops`;
  const departmentManagerUsername = `${prefix}_manager`;
  const employeeUsername = `${prefix}_employee`;

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.department.create({
      data: {
        id: departmentId,
        code: `${prefix}_dept`,
        name: `${prefix}客服部`,
      },
    });
    await createUser({
      id: ownerId,
      username: ownerUsername,
      name: "账号测试老板",
      role: "SUPER_ADMIN",
      departmentId: null,
    });
    await createUser({
      id: operationsAdminId,
      username: operationsUsername,
      name: "账号测试运营组长",
      role: "OPERATIONS_ADMIN",
      departmentId,
    });
    await createUser({
      id: departmentManagerId,
      username: departmentManagerUsername,
      name: "账号测试部门组长",
      role: "DEPARTMENT_MANAGER",
      departmentId,
    });
    await createUser({
      id: employeeId,
      username: employeeUsername,
      name: "账号测试员工",
      role: "EMPLOYEE",
      departmentId,
    });
  });

  test.beforeEach(async () => {
    await database.rateLimit.deleteMany();
  });

  test.afterAll(async () => {
    await database.user.deleteMany({
      where: { username: { startsWith: prefix } },
    });
    await database.department.deleteMany({ where: { id: departmentId } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  test("普通员工不能进入账号终端", async ({ page }) => {
    await signIn(page, employeeUsername, initialPassword);
    await page.goto("/accounts");

    await expect(
      page.getByRole("heading", { level: 1, name: "没有找到这个页面" }),
    ).toBeVisible();
  });

  test("部门组长不能进入账号终端", async ({ page }) => {
    await signIn(page, departmentManagerUsername, initialPassword);
    await page.goto("/accounts");

    await expect(
      page.getByRole("heading", { level: 1, name: "没有找到这个页面" }),
    ).toBeVisible();
  });

  test("最高管理员创建账号后只在当次结果看到新密码", async ({ page }) => {
    const createdUsername = `${prefix}_service`;
    await signIn(page, ownerUsername, initialPassword);
    await page.goto("/accounts");
    await page.getByRole("button", { name: "创建员工账号" }).click();
    await page.getByLabel("员工姓名", { exact: true }).fill("客服小周");
    await page.getByLabel("登录账号").fill(createdUsername);
    await page.getByLabel("账号角色").selectOption("EMPLOYEE");
    await page.getByLabel("所属部门").selectOption(departmentId);
    await page.getByRole("button", { name: "生成账号密码" }).click();

    const credentials = page.getByRole("status", { name: "一次性账号密码" });
    await expect(credentials).toContainText(createdUsername);
    const plaintextPassword = await credentials
      .getByTestId("one-time-password")
      .textContent();
    expect(plaintextPassword).toBeTruthy();

    const storedCredential = await database.account.findFirstOrThrow({
      where: { user: { username: createdUsername }, providerId: "credential" },
    });
    expect(storedCredential.password).not.toBe(plaintextPassword);
    await expect(
      verifyPassword({
        hash: storedCredential.password!,
        password: plaintextPassword!,
      }),
    ).resolves.toBe(true);

    await page.reload();
    await expect(page.getByTestId("one-time-password")).toHaveCount(0);
    await expect(page.getByText(`@${createdUsername}`)).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });

  test("重置密码和停用账号都会让员工旧会话立即失效", async ({
    browser,
    page,
  }) => {
    const employeeContext = await browser.newContext();
    const employeePage = await employeeContext.newPage();
    await signIn(employeePage, employeeUsername, initialPassword);
    await signIn(page, ownerUsername, initialPassword);
    await page.goto(`/accounts?q=${employeeUsername}`);

    const accountRow = page.locator(`[data-account-id="${employeeId}"]`);
    await accountRow.getByRole("button", { name: "重置密码" }).click();
    const resetPassword = await accountRow
      .getByTestId("one-time-password")
      .textContent();
    expect(resetPassword).toBeTruthy();

    await employeePage.goto("/");
    await expect(employeePage).toHaveURL(/\/login$/);
    await signIn(employeePage, employeeUsername, resetPassword!);

    await accountRow.getByRole("button", { name: "停用账号" }).click();
    await expect(accountRow.getByText("已停用", { exact: true })).toBeVisible();
    await employeePage.goto("/");
    await expect(employeePage).toHaveURL(/\/login$/);

    await employeePage.getByLabel("登录账号").fill(employeeUsername);
    await employeePage.getByLabel("密码").fill(resetPassword!);
    await employeePage.getByRole("button", { name: "登录" }).click();
    await expect(
      employeePage.getByRole("alert").filter({ hasText: "账号或密码错误" }),
    ).toBeVisible();
    await employeeContext.close();
  });

  test("运营组长看不到也不能创建最高管理员", async ({ page }) => {
    await signIn(page, operationsUsername, initialPassword);
    await page.goto("/accounts");

    await expect(page.getByText(`@${ownerUsername}`)).toHaveCount(0);
    await page.getByRole("button", { name: "创建员工账号" }).click();
    await expect(page.getByLabel("账号角色").locator("option[value=SUPER_ADMIN]")).toHaveCount(0);
  });

  async function createUser(input: {
    id: string;
    username: string;
    name: string;
    role:
      | "SUPER_ADMIN"
      | "OPERATIONS_ADMIN"
      | "DEPARTMENT_MANAGER"
      | "EMPLOYEE";
    departmentId: string | null;
  }) {
    await database.user.create({
      data: {
        ...input,
        email: `${input.username}@internal.invalid`,
        emailVerified: true,
        displayUsername: input.username,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: input.id,
            providerId: "credential",
            password: await hashPassword(initialPassword),
          },
        },
      },
    });
  }
});

async function signIn(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("登录账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL("/");
}
