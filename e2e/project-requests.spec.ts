import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const password = "ProjectRequestE2ePassword_2026";
const prefix = `requestui_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.describe.configure({ mode: "serial" });
test.describe("执行建议与立项申请", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const departmentId = randomUUID();
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const ownerUsername = `${prefix}_owner`;
  const operationsUsername = `${prefix}_ops`;
  const title = `${prefix}小红书收纳主图模式`;
  const rejectedProjectName = `${prefix}主图首轮验证`;
  const approvedProjectName = `${prefix}供应链核价`;
  let businessModelId = "";

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.department.create({ data: { id: departmentId, code: `${prefix}_ops`, name: `${prefix}运营部` } });
    await createUser(ownerId, ownerUsername, "立项审批测试老板", "SUPER_ADMIN", null);
    await createUser(operationsId, operationsUsername, "立项申请测试运营组长", "OPERATIONS_ADMIN", departmentId);
    const model = await database.businessModel.create({ data: {
      title, category: "家居", targetPlatform: "小红书", opportunity: "场景图提升决策效率",
      businessLogic: "内容测试筛选高意向人群", executionPlan: "每周测试三组主图",
      costAssumptions: "样品成本", revenueAssumptions: "验证首单成本", risks: "素材同质化",
      tags: ["场景电商"], keywords: ["收纳"], createdById: ownerId, updatedById: ownerId,
    } });
    businessModelId = model.id;
    await database.businessModelEvent.create({ data: {
      businessModelId, actorId: ownerId, type: "CREATED", revision: 1,
      snapshot: { title, status: "ACTIVE", revision: 1 },
    } });
  });

  test.beforeEach(async () => { await database.rateLimit.deleteMany(); });
  test.afterAll(async () => {
    await database.projectEvent.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.projectConversation.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.projectDepartment.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.projectMember.deleteMany({ where: { project: { sourceBusinessModelId: businessModelId } } });
    await database.project.deleteMany({ where: { sourceBusinessModelId: businessModelId } });
    await database.notification.deleteMany({ where: { recipientId: operationsId } });
    await database.projectRequestEvent.deleteMany({ where: { request: { businessModelId } } });
    await database.projectRequest.deleteMany({ where: { businessModelId } });
    await database.executionSuggestion.deleteMany({ where: { businessModelId } });
    await database.businessModelEvent.deleteMany({ where: { businessModelId } });
    await database.businessModel.deleteMany({ where: { id: businessModelId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: departmentId } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  test("运营组长添加独立建议并提交立项申请", async ({ page }) => {
    await signIn(page, operationsUsername);
    await page.goto(`/business-models/${businessModelId}`);
    await page.getByLabel("建议内容").fill("先测试三组主图，再按点击率追加预算。");
    await page.getByRole("button", { name: "保存执行建议" }).click();
    await expect(page.getByText("执行建议已单独保存，原始商业内容没有被改动。")).toBeVisible();

    const suggestionSelect = page.locator('select[name="suggestionId"]');
    await expect(suggestionSelect).toBeEnabled();
    await suggestionSelect.selectOption({ index: 1 });
    await page.getByLabel("拟定项目名称").fill(rejectedProjectName);
    await page.getByLabel("验证目标").fill("七天内验证点击率和首单成本。");
    await page.getByRole("button", { name: "提交立项申请" }).click();
    await expect(page.getByText("立项申请已提交，等待最高管理员审批。")).toBeVisible();

    await expect(database.businessModel.findUniqueOrThrow({ where: { id: businessModelId } }))
      .resolves.toMatchObject({ revision: 1, executionPlan: "每周测试三组主图" });
  });

  test("最高管理员拒绝时必须填写原因并通知申请人", async ({ page }) => {
    await signIn(page, ownerUsername);
    await page.goto("/project-requests?status=PENDING");
    const card = page.getByRole("heading", { name: rejectedProjectName }).locator("..").locator("..");
    await card.getByRole("button", { name: "拒绝并通知" }).click();
    await expect(card.getByText("拒绝申请必须填写 2 至 2000 字的原因。")).toBeVisible();
    await card.getByLabel("拒绝原因").fill("预算依据不足");
    await card.getByRole("button", { name: "拒绝并通知" }).click();
    await expect(page.getByRole("heading", { name: rejectedProjectName })).toHaveCount(0);

    const request = await database.projectRequest.findFirstOrThrow({ where: { proposedName: rejectedProjectName } });
    expect(request).toMatchObject({ status: "REJECTED", rejectionReason: "预算依据不足", version: 2 });
    await expect(database.notification.findFirstOrThrow({ where: { resourceId: request.id } }))
      .resolves.toMatchObject({ recipientId: operationsId, type: "PROJECT_REQUEST_REJECTED", message: "预算依据不足", isRead: false });
  });

  test("运营可再次申请，最高管理员可批准并生成完整项目空间", async ({ page }) => {
    await signIn(page, operationsUsername);
    await page.goto(`/business-models/${businessModelId}`);
    await page.getByLabel("建议内容").fill("先做小规模供应链核价。");
    await page.getByRole("button", { name: "保存执行建议" }).click();
    const suggestionSelect = page.locator('select[name="suggestionId"]');
    await expect(suggestionSelect).toBeEnabled();
    await suggestionSelect.selectOption({ index: 1 });
    await page.getByLabel("拟定项目名称").fill(approvedProjectName);
    await page.getByLabel("验证目标").fill("确认毛利空间。");
    await page.getByRole("button", { name: "提交立项申请" }).click();

    await signOut(page);
    await signIn(page, ownerUsername);
    await page.goto("/project-requests?status=PENDING");
    const card = page.getByRole("heading", { name: approvedProjectName }).locator("..").locator("..");
    await card.getByRole("button", { name: "批准申请" }).click();
    await expect(page.getByRole("heading", { name: approvedProjectName })).toHaveCount(0);
    await expect(database.projectRequest.findFirstOrThrow({ where: { proposedName: approvedProjectName } }))
      .resolves.toMatchObject({ status: "APPROVED", reviewedById: ownerId, version: 2 });

    await page.goto("/project-requests?status=APPROVED");
    const approvedCard = page.getByRole("heading", { name: approvedProjectName }).locator("..").locator("..");
    await approvedCard.getByRole("button", { name: "生成正式项目" }).click();
    await expect(approvedCard.getByText("已生成正式项目：", { exact: false })).toBeVisible();

    const request = await database.projectRequest.findFirstOrThrow({ where: { proposedName: approvedProjectName } });
    const project = await database.project.findUniqueOrThrow({ where: { sourceRequestId: request.id } });
    expect(project).toMatchObject({ sourceBusinessModelId: businessModelId, leadId: operationsId, createdById: ownerId });
    await expect(database.projectMember.count({ where: { projectId: project.id } })).resolves.toBe(2);
    await expect(database.projectDepartment.count({ where: { projectId: project.id } })).resolves.toBe(1);
    await expect(database.projectConversation.count({ where: { projectId: project.id } })).resolves.toBe(1);
  });

  async function createUser(id: string, username: string, name: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN", departmentId: string | null) {
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
