import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const password = "DepartmentE2ePassword_2026";
const prefix = `deptui_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.describe.configure({ mode: "serial" });
test.describe("部门管理", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const serviceId = randomUUID();
  const warehouseId = randomUUID();
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const managerId = randomUUID();
  const employeeId = randomUUID();
  const ownerUsername = `${prefix}_owner`;
  const operationsUsername = `${prefix}_ops`;
  const managerUsername = `${prefix}_manager`;
  const employeeUsername = `${prefix}_employee`;

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.department.createMany({ data: [
      { id: serviceId, code: `${prefix}_service`, name: `${prefix}客服部` },
      { id: warehouseId, code: `${prefix}_warehouse`, name: `${prefix}仓库部` },
    ] });
    await createUser(ownerId, ownerUsername, "部门测试老板", "SUPER_ADMIN", null);
    await createUser(operationsId, operationsUsername, "部门测试运营组长", "OPERATIONS_ADMIN", serviceId);
    await createUser(managerId, managerUsername, "部门测试客服组长", "DEPARTMENT_MANAGER", serviceId);
    await createUser(employeeId, employeeUsername, "待调动员工", "EMPLOYEE", serviceId);
  });

  test.beforeEach(async () => { await database.rateLimit.deleteMany(); });
  test.afterAll(async () => {
    await database.departmentMembershipHistory.deleteMany({ where: { memberId: employeeId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { name: { startsWith: prefix } } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  test("运营组长可跨部门调动员工并留下记录", async ({ page }) => {
    await signIn(page, operationsUsername);
    await page.goto("/departments");
    const member = page.locator(`[data-member-id="${employeeId}"]`);
    await expect(member).toContainText("待调动员工");
    await member.getByLabel("调动到").selectOption(warehouseId);
    await member.getByRole("button", { name: "确认调动" }).click();
    await expect(
      page
        .getByRole("region", { name: `${prefix}仓库部` })
        .locator(`[data-member-id="${employeeId}"]`),
    ).toContainText("待调动员工");
    await expect(database.user.findUniqueOrThrow({ where: { id: employeeId } }))
      .resolves.toMatchObject({ departmentId: warehouseId });
    await expect(database.departmentMembershipHistory.count({ where: { memberId: employeeId } }))
      .resolves.toBe(1);
  });

  test("部门组长只能看到本部门成员且不能调动人员", async ({ page }) => {
    await signIn(page, managerUsername);
    await page.goto("/departments");
    await expect(page.getByRole("heading", { name: `${prefix}客服部` })).toBeVisible();
    await expect(page.getByRole("heading", { name: `${prefix}仓库部` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "确认调动" })).toHaveCount(0);
  });

  test("普通员工不能进入部门管理", async ({ page }) => {
    await signIn(page, employeeUsername);
    await page.goto("/departments");
    await expect(page.getByRole("heading", { level: 1, name: "没有找到这个页面" })).toBeVisible();
  });

  test("最高管理员可新增并停用空部门", async ({ page }) => {
    const departmentName = `${prefix}直播部`;
    await signIn(page, ownerUsername);
    await page.goto("/departments");
    await page.getByRole("button", { name: "新增部门" }).click();
    await page.getByLabel("部门名称").fill(departmentName);
    await page.getByLabel("部门编码").fill(`${prefix}_live`);
    await page.getByRole("button", { name: "确认创建" }).click();
    await expect(page.getByText("部门已创建，可以开始添加成员。")).toBeVisible();
    await page.getByRole("button", { name: "关闭新增部门窗口" }).click();

    const department = page.getByRole("region", { name: departmentName });
    await expect(department).toBeVisible();
    await department.getByRole("button", { name: "停用部门" }).click();
    await expect(department.getByText("已停用", { exact: true })).toBeVisible();
  });

  async function createUser(id: string, username: string, name: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "DEPARTMENT_MANAGER" | "EMPLOYEE", departmentId: string | null) {
    await database.user.create({ data: {
      id, username, name, role, departmentId,
      email: `${username}@internal.invalid`, emailVerified: true, displayUsername: username,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    } });
  }
});

async function signIn(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("登录账号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL("/");
}
