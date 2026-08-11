import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const password = "ProjectMembersE2ePassword_2026";
const prefix = `membersui_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.describe.configure({ mode: "serial" });
test.describe("项目成员管理", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const operationsDepartmentId = randomUUID();
  const serviceDepartmentId = randomUUID();
  const ownerId = randomUUID();
  const leadId = randomUUID();
  const memberId = randomUUID();
  const ownerUsername = `${prefix}_owner`;
  const leadUsername = `${prefix}_lead`;
  const memberUsername = `${prefix}_member`;
  const projectName = `${prefix}跨部门主图项目`;
  const memberName = "项目成员测试客服";
  let projectId = "";
  let businessModelId = "";

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.department.createMany({ data: [
      { id: operationsDepartmentId, code: `${prefix}_ops`, name: `${prefix}运营部` },
      { id: serviceDepartmentId, code: `${prefix}_service`, name: `${prefix}客服部` },
    ] });
    await createUser(ownerId, ownerUsername, "项目成员测试老板", "SUPER_ADMIN", null);
    await createUser(leadId, leadUsername, "项目成员测试运营组长", "OPERATIONS_ADMIN", operationsDepartmentId);
    await createUser(memberId, memberUsername, memberName, "EMPLOYEE", serviceDepartmentId);
    const model = await database.businessModel.create({ data: {
      title: `${prefix}场景主图模式`, category: "家居", targetPlatform: "淘宝",
      opportunity: "用场景主图提升转化", businessLogic: "内容筛选高意向人群", executionPlan: "每周测试三组主图",
      createdById: ownerId, updatedById: ownerId,
    } });
    businessModelId = model.id;
    const suggestion = await database.executionSuggestion.create({ data: { businessModelId, authorId: leadId, content: "先验证三组主图，再追加预算。" } });
    const request = await database.projectRequest.create({ data: {
      businessModelId, suggestionId: suggestion.id, proposedName: projectName, objective: "七天内验证点击率和首单成本",
      status: "APPROVED", requestedById: leadId, reviewedById: ownerId, reviewedAt: new Date(),
    } });
    const project = await database.project.create({ data: {
      name: projectName, objective: request.objective, sourceBusinessModelId: businessModelId, sourceRequestId: request.id,
      leadId, createdById: ownerId,
      members: { create: [
        { userId: leadId, role: "LEAD", addedById: ownerId },
        { userId: ownerId, role: "MEMBER", addedById: ownerId },
      ] },
      departments: { create: { departmentId: operationsDepartmentId, addedById: ownerId } },
      conversation: { create: { createdById: ownerId } },
      events: { create: { actorId: ownerId, type: "CREATED", revision: 1, details: { sourceRequestId: request.id } } },
    } });
    projectId = project.id;
  });

  test.beforeEach(async () => { await database.rateLimit.deleteMany(); });
  test.afterAll(async () => {
    await database.projectEvent.deleteMany({ where: { projectId } });
    await database.projectConversation.deleteMany({ where: { projectId } });
    await database.projectDepartment.deleteMany({ where: { projectId } });
    await database.projectMember.deleteMany({ where: { projectId } });
    await database.project.deleteMany({ where: { id: projectId } });
    await database.projectRequest.deleteMany({ where: { businessModelId } });
    await database.executionSuggestion.deleteMany({ where: { businessModelId } });
    await database.businessModel.deleteMany({ where: { id: businessModelId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: { in: [operationsDepartmentId, serviceDepartmentId] } } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  test("最高管理员添加项目成员、更新状态并立即收回被移除成员的访问权", async ({ page }) => {
    await signIn(page, ownerUsername);
    await page.goto("/projects");
    await page.getByRole("link", { name: projectName }).click();
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await page.getByLabel("选择员工").selectOption(memberId);
    await page.getByRole("button", { name: "添加成员" }).click();
    await expect(page.getByText("成员已加入项目并获得访问权。")).toBeVisible();
    await expect(page.getByText(memberName, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "添加项目成员" })).toBeVisible();

    await page.getByLabel("项目状态").selectOption("IN_PROGRESS");
    await page.getByRole("button", { name: "更新状态" }).click();
    await expect(page.getByText("项目状态已更新并写入时间线。")).toBeVisible();
    await expect(page.getByText("进行中", { exact: true }).first()).toBeVisible();

    await signOut(page);
    await signIn(page, memberUsername);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

    await signOut(page);
    await signIn(page, ownerUsername);
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: `移除 ${memberName} · ${prefix}客服部` }).click();
    await expect(page.getByText("成员已移除，项目访问权已立即收回。")).toBeVisible();

    await signOut(page);
    await signIn(page, memberUsername);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: projectName })).toHaveCount(0);
  });

  async function createUser(id: string, username: string, name: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "EMPLOYEE", departmentId: string | null) {
    await database.user.create({ data: {
      id, username, name, role, departmentId, displayUsername: username,
      email: `${username}@internal.invalid`, emailVerified: true,
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

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL("/login");
}
