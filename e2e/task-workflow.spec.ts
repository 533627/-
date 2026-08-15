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

  test("组长派发，员工提交，被退回后再次提交并验收", async ({ page }) => {
    await signIn(page, managerUsername);
    await page.goto(`/projects/${projectId}`);
    await page.getByLabel("任务标题").fill(taskTitle);
    await page.getByLabel("任务说明").fill("突出收纳前后对比，交付三版 1:1 主图");
    await page.getByLabel("负责人").selectOption(employeeId);
    await page.getByLabel("优先级").selectOption("HIGH");
    await page.getByLabel("截止时间").fill(futureLocalDateTime());
    await page.getByRole("button", { name: "派发任务" }).click();
    await expect(page.getByText("任务已派发，员工可在任务待办中接收。")).toBeVisible();
    taskId = (await database.task.findFirstOrThrow({ where: { title: taskTitle } })).id;

    await signOut(page);
    await signIn(page, employeeUsername);
    await page.goto("/tasks");
    let card = page.getByTestId(`task-${taskId}`);
    await card.getByRole("button", { name: "接收任务" }).click();
    await expect(card.getByText("任务已接收。")).toBeVisible();
    await card.getByRole("button", { name: "开始执行" }).click();
    await expect(card.getByText("任务已开始执行。")).toBeVisible();
    await card.getByLabel("成果说明").fill("三版主图已完成并上传到项目素材目录");
    await card.getByRole("button", { name: "提交验收" }).click();
    await expect(card.getByText("成果已提交，等待验收。")).toBeVisible();

    await signOut(page);
    await signIn(page, managerUsername);
    await page.goto("/tasks");
    card = page.getByTestId(`task-${taskId}`);
    await card.getByLabel("退回原因").fill("第二版核心卖点不够突出");
    await card.getByRole("button", { name: "退回修改" }).click();
    await expect(card.getByText("任务已退回修改，原因已记录。")).toBeVisible();

    await signOut(page);
    await signIn(page, employeeUsername);
    await page.goto("/tasks");
    card = page.getByTestId(`task-${taskId}`);
    await expect(card.getByText("退回原因：第二版核心卖点不够突出")).toBeVisible();
    await card.getByLabel("成果说明").fill("已重做第二版并突出核心卖点");
    await card.getByRole("button", { name: "提交验收" }).click();

    await signOut(page);
    await signIn(page, managerUsername);
    await page.goto("/tasks");
    card = page.getByTestId(`task-${taskId}`);
    await card.getByRole("button", { name: "验收通过" }).click();
    await expect(card.getByText("任务已验收完成。")).toBeVisible();
    await expect(database.task.findUniqueOrThrow({ where: { id: taskId } })).resolves.toMatchObject({ status: "COMPLETED", version: 7 });
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
    await page.getByLabel("负责人").selectOption(employeeId);
    await page.getByLabel("截止时间").fill(futureLocalDateTime());
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
    await card.getByRole("button", { name: "确认完成" }).click();
    await expect(card.getByText("任务已确认完成。")).toBeVisible();
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

function futureLocalDateTime() {
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(" ", "T");
}
async function signIn(page: import("@playwright/test").Page, username: string) { await page.goto("/login"); await page.getByLabel("登录账号").fill(username); await page.getByLabel("密码").fill(password); await page.getByRole("button", { name: "登录" }).click(); await expect(page).toHaveURL("/"); }
async function signOut(page: import("@playwright/test").Page) { await page.getByRole("button", { name: "退出登录" }).click(); await expect(page).toHaveURL("/login"); }
