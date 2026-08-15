import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const password = "TaskWorkflowE2ePassword_2026";
const prefix = `taskui_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.describe.configure({ mode: "serial" });
test.describe("任务闭环", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const departmentId = randomUUID();
  const ownerId = randomUUID();
  const managerId = randomUUID();
  const employeeId = randomUUID();
  const ownerUsername = `${prefix}_owner`;
  const managerUsername = `${prefix}_manager`;
  const employeeUsername = `${prefix}_employee`;
  const employeeName = `${prefix}客服员工`;
  const taskTitle = `${prefix}完成三版商品主图`;
  let businessModelId = "";
  let projectId = "";
  let taskId = "";

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.department.create({ data: { id: departmentId, code: `${prefix}_service`, name: `${prefix}客服部` } });
    await createUser(ownerId, ownerUsername, `${prefix}老板`, "SUPER_ADMIN");
    await createUser(managerId, managerUsername, `${prefix}运营组长`, "OPERATIONS_ADMIN", "TEAM_ONE");
    await createUser(employeeId, employeeUsername, employeeName, "EMPLOYEE", "TEAM_ONE");
    const model = await database.businessModel.create({ data: {
      title: `${prefix}场景主图模式`, category: "家居", targetPlatform: "淘宝", opportunity: "提升点击率",
      businessLogic: "内容筛选高意向用户", executionPlan: "测试三版主图", createdById: ownerId, updatedById: ownerId,
    } });
    businessModelId = model.id;
    const suggestion = await database.executionSuggestion.create({ data: { businessModelId, authorId: managerId, content: "先测试三版主图" } });
    const request = await database.projectRequest.create({ data: {
      businessModelId, suggestionId: suggestion.id, proposedName: `${prefix}主图项目`, objective: "七天验证点击率",
      status: "APPROVED", requestedById: managerId, reviewedById: ownerId, reviewedAt: new Date(),
    } });
    const project = await database.project.create({ data: {
      name: request.proposedName, objective: request.objective, sourceBusinessModelId: businessModelId,
      sourceRequestId: request.id, leadId: managerId, createdById: ownerId,
      members: { create: [
        { userId: ownerId, role: "MEMBER", addedById: ownerId },
        { userId: managerId, role: "LEAD", addedById: ownerId },
        { userId: employeeId, role: "MEMBER", addedById: ownerId },
      ] },
      conversation: { create: { createdById: ownerId } },
      events: { create: { actorId: ownerId, type: "CREATED", revision: 1, details: { sourceRequestId: request.id } } },
    } });
    projectId = project.id;
  });

  test.beforeEach(async () => { await database.rateLimit.deleteMany(); });
  test.afterAll(async () => {
    await database.taskEvent.deleteMany({ where: { task: { OR: [{ assignedById: managerId }, { assigneeId: employeeId }] } } });
    await database.task.deleteMany({ where: { OR: [{ assignedById: managerId }, { assigneeId: employeeId }] } });
    await database.taskEvent.deleteMany({ where: { task: { projectId } } });
    await database.task.deleteMany({ where: { projectId } });
    await database.projectEvent.deleteMany({ where: { projectId } });
    await database.projectConversation.deleteMany({ where: { projectId } });
    await database.projectMember.deleteMany({ where: { projectId } });
    await database.project.deleteMany({ where: { id: projectId } });
    await database.projectRequest.deleteMany({ where: { businessModelId } });
    await database.executionSuggestion.deleteMany({ where: { businessModelId } });
    await database.businessModel.deleteMany({ where: { id: businessModelId } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: departmentId } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  test("组长派发含多个小任务的主任务，员工逐条完成", async ({ page }) => {
    await signIn(page, managerUsername);
    await page.goto(`/projects/${projectId}`);
    await page.getByLabel("任务标题").fill(taskTitle);
    await page.getByLabel("任务说明").fill("突出收纳前后对比，交付三版 1:1 主图");
    await page.getByLabel("第 1 条小任务标题").fill("整理商品素材");
    await page.getByLabel("第 1 条小任务说明").fill("检查图片和文案");
    await page.getByRole("button", { name: "添加小任务" }).click();
    await page.getByLabel("第 2 条小任务标题").fill("制作三版商品主图");
    await page.getByLabel("负责人").selectOption(employeeId);
    await page.getByLabel("优先级").selectOption("HIGH");
    await page.getByLabel("开始时间").fill(futureLocalDateTime(1));
    await page.getByLabel("结束时间").fill(futureLocalDateTime(3));
    await page.getByRole("button", { name: "派发任务" }).click();
    await expect(page.getByText("任务已派发，员工可在任务待办中接收。")).toBeVisible();
    taskId = (await database.task.findFirstOrThrow({ where: { title: taskTitle } })).id;

    await signOut(page);
    await signIn(page, employeeUsername);
    await page.goto("/tasks");
    const card = page.getByTestId(`task-${taskId}`);
    await card.getByRole("listitem").filter({ hasText: "整理商品素材" }).getByRole("button", { name: "确认完成" }).click();
    await expect(card.getByText("小任务已确认完成。")).toBeVisible();
    await card.getByRole("listitem").filter({ hasText: "制作三版商品主图" }).getByRole("button", { name: "确认完成" }).click();
    await expect(card.getByText("全部小任务已完成，主任务已自动完成。")).toBeVisible();
    await expect(database.task.findUniqueOrThrow({ where: { id: taskId } })).resolves.toMatchObject({ status: "COMPLETED", completedAt: expect.any(Date) });
  });

  test("运营组长在任务中心发布，员工本人直接确认完成", async ({ page }) => {
    const directTaskTitle = `${prefix}整理今日商品数据`;
    await signIn(page, managerUsername);
    await page.goto("/tasks");
    await page.getByRole("button", { name: "发布任务" }).click();
    await expect(page.getByRole("dialog", { name: "发布任务" })).toBeVisible();
    await expect(page.getByRole("button", { name: "新建任务" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "派发新任务" })).toBeVisible();
    await page.getByLabel("关联项目").selectOption("");
    await page.getByLabel("任务标题").fill(directTaskTitle);
    await page.getByLabel("第 1 条小任务标题").fill("汇总商品数据");
    await page.getByLabel("负责人").selectOption(employeeId);
    await page.getByLabel("开始时间").fill(futureLocalDateTime(1));
    await page.getByLabel("结束时间").fill(futureLocalDateTime(3));
    await page.getByRole("button", { name: "派发任务" }).click();
    await expect(page.getByText("任务已派发，员工可在任务待办中接收。")).toBeVisible();
    const directTask = await database.task.findFirstOrThrow({ where: { title: directTaskTitle } });

    await database.task.update({ where: { id: directTask.id }, data: { createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    await page.reload();
    await page.getByRole("button", { name: "发布任务" }).click();
    await page.getByRole("button", { name: /复用昨日任务/ }).click();
    await page.getByRole("button", { name: new RegExp(directTaskTitle) }).click();
    await expect(page.getByLabel("任务标题")).toHaveValue(directTaskTitle);
    await expect(page.getByLabel("负责人")).toHaveValue(employeeId);
    await page.getByLabel("任务标题").fill(`${directTaskTitle}（复用）`);
    await page.getByRole("button", { name: "派发任务" }).click();
    await expect(page.getByText("任务已派发，员工可在任务待办中接收。")).toBeVisible();
    await page.getByRole("button", { name: "关闭发布任务窗口" }).click();

    await signOut(page);
    await signIn(page, employeeUsername);
    await page.goto("/tasks");
    const card = page.getByTestId(`task-${directTask.id}`);
    await card.getByRole("listitem").filter({ hasText: "汇总商品数据" }).getByRole("button", { name: "确认完成" }).click();
    await expect(card.getByText("全部小任务已完成，主任务已自动完成。")).toBeVisible();
    await expect(database.task.findUniqueOrThrow({ where: { id: directTask.id } }))
      .resolves.toMatchObject({ status: "COMPLETED", completedAt: expect.any(Date) });
  });

  async function createUser(id: string, username: string, name: string, role: "SUPER_ADMIN" | "OPERATIONS_ADMIN" | "EMPLOYEE", operationsTeam: "TEAM_ONE" | "TEAM_TWO" | null = null) {
    await database.user.create({ data: {
      id, username, name, role, departmentId: role === "SUPER_ADMIN" ? null : departmentId,
      operationsTeam,
      displayUsername: username, email: `${username}@internal.invalid`, emailVerified: true,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    } });
  }
});

function futureLocalDateTime(days = 3) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(" ", "T");
}
async function signIn(page: import("@playwright/test").Page, username: string) { await page.goto("/login"); await page.getByLabel("登录账号").fill(username); await page.getByLabel("密码").fill(password); await page.getByRole("button", { name: "登录" }).click(); await expect(page).toHaveURL("/"); }
async function signOut(page: import("@playwright/test").Page) { await page.getByRole("button", { name: "退出登录" }).click(); await expect(page).toHaveURL("/login"); }
