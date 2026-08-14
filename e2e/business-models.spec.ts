import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const password = "BusinessModelE2ePassword_2026";
const prefix = `modelui_${randomUUID().replaceAll("-", "").slice(0, 8)}`;

test.describe.configure({ mode: "serial" });
test.describe("商业整理", () => {
  test.skip(!databaseUrl, "TEST_DATABASE_URL or DATABASE_URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const departmentId = randomUUID();
  const ownerId = randomUUID();
  const operationsId = randomUUID();
  const ownerUsername = `${prefix}_owner`;
  const operationsUsername = `${prefix}_ops`;
  const title = `${prefix}小红书家居选品`;
  let businessModelId = "";

  test.beforeAll(async () => {
    await database.rateLimit.deleteMany();
    await database.department.create({ data: { id: departmentId, code: `${prefix}_ops`, name: `${prefix}运营部` } });
    await createUser(ownerId, ownerUsername, "商业整理测试老板", "SUPER_ADMIN", null);
    await createUser(operationsId, operationsUsername, "商业整理测试运营组长", "OPERATIONS_ADMIN", departmentId);
  });

  test.beforeEach(async () => { await database.rateLimit.deleteMany(); });
  test.afterAll(async () => {
    await database.businessModelEvent.deleteMany({ where: { businessModel: { title: { startsWith: prefix } } } });
    await database.businessModel.deleteMany({ where: { title: { startsWith: prefix } } });
    await database.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await database.department.deleteMany({ where: { id: departmentId } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  test("最高管理员记录商业模式并生成首个版本", async ({ page }) => {
    await signIn(page, ownerUsername);
    await page.goto("/business-models");
    await page.getByRole("button", { name: "记录商业模式" }).click();
    await page.getByLabel("标题", { exact: true }).fill(title);
    await page.getByLabel("行业 / 类目").fill("家居");
    await page.getByLabel("目标平台").fill("小红书");
    await page.getByLabel("机会说明").fill("用户决策依赖场景展示");
    await page.getByLabel("商业逻辑").fill("用内容筛选高意向人群");
    await page.getByLabel("执行打法").fill("每周测试三组场景图");
    await page.getByLabel("成本假设").fill("样品和拍摄成本");
    await page.getByLabel("收益假设").fill("单店月销售额目标");
    await page.getByLabel("主要风险").fill("素材同质化");
    await page.locator('input[name="tags"]').fill("场景电商，家居");
    await page.locator('input[name="keywords"]').fill("小红书，收纳");
    await page.getByLabel("选择参考图片").setInputFiles({
      name: "店铺参考图.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    await expect(page.getByRole("button", { name: "保存商业模式与 1 张图片" })).toBeVisible();
    await page.getByRole("button", { name: "保存商业模式与 1 张图片" }).click();
    await expect(page.getByText("商业模式已记录并生成首个审计版本。")).toBeVisible();
    await expect(page.getByText("商业模式与 1 张图片均已保存。")).toBeVisible();

    const record = await database.businessModel.findFirstOrThrow({ where: { title } });
    businessModelId = record.id;
    expect(record).toMatchObject({ status: "ACTIVE", revision: 1 });
    await expect(database.businessModelImage.count({ where: { businessModelId } })).resolves.toBe(1);
  });

  test("运营组长可按类目标签关键词筛选但不能修改原文", async ({ page }) => {
    await signIn(page, operationsUsername);
    await page.goto("/business-models?category=家居&tag=场景电商&keyword=收纳");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByRole("button", { name: "记录商业模式" })).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByText("你当前拥有只读权限，可以查看原始内容但不能修改。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "编辑原始内容" })).toHaveCount(0);
  });

  test("最高管理员编辑、归档并软删除时保留全部版本", async ({ page }) => {
    await signIn(page, ownerUsername);
    await page.goto(`/business-models/${businessModelId}`);
    await page.getByLabel("执行打法").fill("更新后的执行打法");
    await page.getByRole("button", { name: "保存新版本" }).click();
    await expect(page.getByText("已保存为版本 2。")).toBeVisible();
    await page.getByRole("button", { name: "归档记录" }).click();
    await expect(page.getByText("商业模式已归档，原始内容已冻结。")).toBeVisible();
    await page.getByRole("button", { name: "软删除记录" }).click();
    await expect(page.getByText("商业模式已软删除，全部历史仍被保留。")).toBeVisible();

    await expect(database.businessModel.findUniqueOrThrow({ where: { id: businessModelId } }))
      .resolves.toMatchObject({ status: "DELETED", revision: 4 });
    await expect(database.businessModelEvent.count({ where: { businessModelId } }))
      .resolves.toBe(4);
    await page.goto("/business-models");
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
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
