# Spec：公司电商运营终端 V1

状态：已由用户确认  
日期：2026-08-11

## 1. Objective

建设一套单公司内部使用的响应式网页系统，将电商项目的商业模式沉淀、立项、任务分派、部门协作、成果提交和验收统一到一个可审计的平台中。

核心成功结果：

- 老板可随时查看每个项目的负责人、当前阶段、逾期任务和验收结果。
- 员工登录后自动进入所属部门，只能看到其角色允许访问的数据和操作。
- 商业模式可以一键转为项目，项目自动获得协作群并可继续拆解任务。
- 任务完成必须经过提交与验收两步，退回原因和再次提交过程完整留痕。
- 部门群、项目群、图片和文件均与业务对象绑定，不再依赖零散聊天记录。

## 2. Assumptions requiring approval

1. 系统只服务一家公司，不做多租户 SaaS。
2. 首期按 20–200 个员工、同时在线不超过 100 人设计。
3. 系统部署在公网云服务器，员工可在公司外通过手机或电脑浏览器访问。
4. 禁止员工自行注册；账号只能由最高管理员或运营组长创建。
5. 登录使用“用户名 + 密码”，员工不必提供电子邮箱或手机号。
6. 初始密码由系统生成；初次登录不强制修改密码。创建或重置时，最高管理员和运营组长可查看、复制新密码一次；之后系统不再显示原密码，只保存密码哈希。
7. 忘记密码时由最高管理员或运营组长重置，V1 不接入短信或邮件找回。
8. V1 消息采用 3–5 秒自动刷新实现准实时体验；真正的 WebSocket 即时通讯列入后续增强，避免首版引入独立实时服务和额外运维成本。
9. 图片和文件保存在 S3 兼容对象存储中；具体云厂商在部署前确定。
10. V1 使用简体中文和中国时区，不做多语言。

## 3. Users and role model

### 3.1 Departments

- 运营部
- 客服部
- 采购部
- 仓库部

部门由最高管理员维护；上述四个部门为初始化默认数据，后续允许新增或停用部门，不允许直接删除已有业务数据的部门。

### 3.2 Roles

| 角色 | 作用域 | 核心权限 |
| --- | --- | --- |
| 最高管理员 | 全公司 | 全部数据和操作；商业模式原文管理；立项；跨部门派发；成员管理；最终审计 |
| 运营组长/业务管理员 | 全公司业务 | 创建和管理各部门账号；跨部门派发；查看商业模式；补充建议；申请立项；验收其派发任务 |
| 部门组长 | 本部门 | 查看本部门项目；给本部门员工派发任务；验收其派发任务；查看本部门统计 |
| 普通员工 | 本人及被加入的空间 | 查看并处理自己的任务；提交成果；参与所属部门群和被加入的项目群 |

所有权限必须在服务端校验；隐藏按钮只能改善界面，不能作为安全边界。

## 4. Functional requirements

### 4.1 Authentication and account management

- 最高管理员可创建、停用、启用、重置所有账号。
- 运营组长可创建、停用、启用、重置除最高管理员外的账号，并绑定部门与角色。
- 部门组长不可创建账号，只能查看本部门成员。
- 账号与密码管理终端只对最高管理员和运营组长开放。
- 创建账号或重置密码时生成高强度随机密码，并在成功界面中显示、复制一次。
- 离开成功界面后不能重新查看原密码；需要再次交付密码时必须执行重置并生成新密码。
- 数据库只保存不可逆密码哈希，账号列表、接口响应、日志和审计记录均不得包含明文密码。
- 初次登录不强制修改密码；员工可继续使用管理员生成的密码。
- 停用账号立即失去访问权限，并撤销现有会话。
- 系统记录创建账号、重置密码、停用账号、修改角色和部门等安全审计事件，但绝不记录明文密码。

### 4.2 Home dashboard

- 最高管理员：项目总览、任务完成率、待验收、逾期任务、商业模式待立项、部门工作量。
- 运营组长：跨部门项目与任务概览、待处理立项申请、本人待验收任务。
- 部门组长：本部门任务、逾期和待验收情况。
- 普通员工：我的待办、截止时间、退回修改和未读消息。

### 4.3 Business model library

- 每条记录包含标题、行业/类目、目标平台、机会说明、商业逻辑、执行打法、成本与收益假设、风险、图片/文件、标签、创建人和更新时间。
- 只有最高管理员可以新增、修改、归档或删除原始记录。
- 运营组长可以查看全部记录、添加执行建议并提交立项申请。
- 原始内容与运营建议分区保存，运营建议不能覆盖原文。
- 最高管理员可拒绝立项申请，或将记录转为正式项目。

### 4.4 Projects

- 项目由商业模式记录立项生成，并保留来源关联。
- 项目包含名称、目标、负责人、参与部门、参与成员、时间范围、状态和附件。
- 立项时自动创建项目协作群。
- 最高管理员可添加或移除项目成员；移除后成员不能再访问后续消息，但历史审计记录保留。
- 项目状态：筹备中、进行中、暂停、已完成、已归档。
- 项目页面聚合商业模式来源、任务、成员、文件、讨论和时间线。

### 4.5 Tasks and review workflow

- 允许最高管理员和运营组长跨部门派发任务。
- 部门组长只能向本部门成员派发任务。
- 任务必须包含标题、负责人、派发人、所属项目、优先级和截止时间；说明和附件可选。
- 状态：待接收 → 进行中 → 待验收 → 已完成。
- 派发人退回时，任务转为“需修改”，必须填写退回原因；员工重新提交后再次进入“待验收”。
- 每次接收、开始、提交、退回、验收都记录操作者和时间。
- 只有派发人或权限更高的管理员可以验收任务。
- 完成率只统计已验收通过的任务。

### 4.6 Department and project communication

- 每个部门自动拥有一个固定部门群；加入部门即加入群，调离部门即失去后续访问权限。
- 每个项目自动拥有一个项目群；最高管理员维护项目群成员。
- 支持文字、图片和文件消息。
- 消息按时间分页加载，支持未读数量和已读位置。
- 消息不可由普通成员永久删除；V1 允许发送者在短时间内撤回并保留审计事件。
- 部门消息只能被该部门成员及最高管理员、运营组长访问。
- 项目消息只能被项目成员及最高管理员访问。

### 4.7 Files

- V1 支持 JPEG、PNG、WebP、PDF、DOCX、XLSX、ZIP。
- 单文件默认上限 20 MB，可在部署配置中调整。
- 服务端同时校验扩展名、MIME 类型、文件大小和对象归属。
- 使用随机对象键，下载通过鉴权后的短期签名地址完成。
- V1 不提供在线编辑文档，只提供预览图片和下载其他文件。

### 4.8 Notifications

- 站内通知覆盖：新任务、任务临期、任务逾期、提交验收、验收通过、任务退回、立项申请结果、被加入项目。
- 顶部通知中心显示未读数量。
- V1 不接入短信、邮件或企业微信通知。

### 4.9 Audit trail

- 记录账号与权限变化、商业模式变更、立项、项目成员变化、任务状态变化、验收和消息撤回。
- 审计记录只允许最高管理员查看，不允许在应用界面中修改或删除。

## 5. Non-functional requirements

### Security

- 服务器端验证每个受保护页面、Server Action 和 Route Handler 的会话及角色权限。
- 密码使用现代慢哈希算法；会话 Cookie 使用 HttpOnly、Secure、SameSite。
- 登录接口限流，连续失败产生审计记录；返回统一错误，避免枚举用户名。
- 所有输入在服务端使用 schema 校验；React 默认转义用户内容，禁止渲染未清洗 HTML。
- 配置 CSP、HSTS、X-Content-Type-Options、Referrer-Policy 和防点击劫持策略。
- 密钥、数据库地址和对象存储凭证仅通过环境变量注入。
- 文件访问必须同时检查用户身份、群组/项目成员关系和文件归属。

### Performance and reliability

- 常用列表使用服务端分页，默认每页 20 条。
- 主要页面在正常 4G 网络下显示可操作骨架屏，不出现长时间空白。
- 数据库关键查询字段建立索引：部门、负责人、项目、状态、截止时间、创建时间。
- 生产数据库每日自动备份，至少保留 14 天；对象存储启用版本或回收策略。
- 所有时间在数据库中存 UTC，界面按 Asia/Shanghai 显示。

### Accessibility and responsive design

- 符合 WCAG 2.1 AA 的基础要求。
- 所有交互可用键盘完成，表单有可见标签，状态不只依赖颜色表达。
- 验证宽度：320、768、1024、1440 像素。

## 6. Tech stack

依赖版本以创建项目当天锁定的稳定版本为准，并提交 `pnpm-lock.yaml`：

- Runtime：Node.js 24.14.0
- Package manager：pnpm 11.16.0
- Full-stack framework：Next.js 16.3.0，App Router
- UI：React 19.2.8、Tailwind CSS 4.3.3、daisyUI 5.7.16
- Language：TypeScript 6.0.3（与当前 Next.js ESLint 工具链兼容）
- Database：PostgreSQL 17 或 18
- ORM/migrations：Prisma ORM 7.9.1
- Authentication：Better Auth 1.6.26，用户名登录；关闭公开注册
- Validation：Zod 4.4.3
- Unit/integration tests：Vitest 4.1.10
- Browser tests：Playwright 1.62.1
- Object storage：S3-compatible provider；开发环境使用本地兼容服务或测试桶

选择依据：Next.js 官方推荐 App Router 和 TypeScript；官方认证指南建议使用认证库；Prisma 当前支持 Node.js 24 和 PostgreSQL 17/18；daisyUI 5 按官方方式作为 Tailwind CSS 4 插件安装。

## 7. Commands

项目脚手架完成后的标准命令：

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm prisma migrate dev
pnpm prisma migrate deploy
```

## 8. Project structure

```text
company-ops-terminal/
├─ docs/
│  ├─ intent/              # 已确认的产品意图
│  ├─ spec/                # 规格与验收标准
│  └─ plans/               # 实施计划和任务拆分
├─ prisma/
│  ├─ schema.prisma        # 数据模型
│  └─ migrations/          # 可审计迁移历史
├─ public/                 # 静态资源
├─ src/
│  ├─ app/                 # App Router 页面、布局和接口
│  ├─ components/          # 可复用界面组件
│  ├─ features/            # auth、accounts、models、projects、tasks、chat
│  ├─ lib/                 # 数据库、认证、权限、校验、存储
│  └─ test/                # 测试初始化与测试工具
├─ e2e/                    # 关键用户流程浏览器测试
└─ scripts/                # 初始化最高管理员等运维脚本
```

## 9. Code style

- TypeScript 开启严格模式。
- 组件与类型使用 `PascalCase`，函数与变量使用 `camelCase`，数据库枚举使用大写蛇形命名。
- 业务授权以明确的能力函数表达，不在页面里散落角色字符串比较。
- 服务端操作返回可判别结果，界面显示中文错误，不向用户暴露堆栈。

```ts
type TaskAction = "ASSIGN" | "SUBMIT" | "APPROVE" | "REJECT";

export function canReviewTask(actor: Actor, task: TaskSummary): boolean {
  return actor.role === "SUPER_ADMIN" || task.createdById === actor.id;
}
```

## 10. Testing strategy

- 单元测试：权限矩阵、任务状态机、完成率、密码生成规则、输入校验。
- 集成测试：账号创建与停用、首次改密、商业模式立项、任务提交/退回/验收、消息访问控制、文件鉴权。
- E2E：最高管理员创建账号并交付密码；员工登录；商业模式转项目；组长派发任务；员工提交；组长退回并最终验收。
- 安全负向测试：普通员工越权访问其他部门、伪造项目成员身份、访问他人附件、停用账号继续使用旧会话。
- 新业务逻辑先写失败测试，再写最小实现使其通过。

## 11. Delivery slices

1. 项目骨架、数据库连接、健康检查和基础测试。
2. 认证、账号生成、首次改密、部门与角色权限。
3. 角色化首页和员工管理。
4. 商业模式库、运营建议和立项审批。
5. 项目、成员与项目详情。
6. 任务派发、状态机、提交和验收。
7. 部门群、项目群、消息和未读状态。
8. 文件上传、下载鉴权和预览。
9. 通知、统计与审计日志。
10. 响应式与无障碍终审、安全检查、备份和云部署。

每个切片必须保持可构建、测试通过并独立提交。

## 12. Boundaries

### Always

- 在服务端进行认证、授权和输入验证。
- 每个新行为先有失败测试，完成后运行测试、类型检查、Lint 和构建。
- 提交数据库迁移历史和锁文件。
- 对账号、权限、项目和任务关键动作写审计日志。

### Ask first

- 更换数据库或认证方案。
- 接入短信、邮件、企业微信或其他第三方服务。
- 将文件上限提高到 20 MB 以上。
- 修改角色权限矩阵或允许公开注册。
- 删除或破坏性修改生产数据。

### Never

- 提交真实密钥、数据库密码、初始员工密码或生产环境文件。
- 在浏览器本地存储中保存认证令牌。
- 仅依靠前端隐藏控制权限。
- 记录明文密码或在日志中输出会话令牌。
- 删除失败测试来使流水线通过。

## 13. V1 acceptance criteria

- 四类角色均可使用管理者创建的账号登录，并看到正确的默认部门空间。
- 非授权用户直接请求受保护接口时收到拒绝，不能仅通过构造 URL 越权。
- 最高管理员和运营组长可在密码终端创建或重置员工密码，并仅在当次结果中查看、复制；其他角色不能访问该终端。
- 员工可直接使用生成的初始密码登录，不强制改密；系统不能再次显示原密码；停用账号的旧会话立即失效。
- 最高管理员可记录商业模式，运营组长只能增加建议和申请立项。
- 立项后自动创建项目和项目群，最高管理员可维护参与成员。
- 管理者可派发任务；员工提交后必须验收才计为完成；退回与再次提交可追溯。
- 部门群和项目群按成员关系隔离，支持文字、图片和文件消息及未读数量。
- 手机与电脑端完成关键流程，无横向溢出和不可点击控件。
- 单元、集成与关键 E2E 测试通过；生产构建通过；无高危或严重依赖漏洞。

## 14. Deferred decisions

以下内容不阻塞本地原型，但部署前必须确定：

- 公司正式名称、Logo 和品牌主色。
- 云服务器厂商、域名及备案需求。
- PostgreSQL 与对象存储的具体供应商和预算。
- 是否在 V1 后接入企业微信通知或真正的 WebSocket 即时通讯。

## 15. Official references

- Next.js installation and App Router: https://nextjs.org/docs/app/getting-started/installation
- Next.js authentication guidance: https://nextjs.org/docs/app/guides/authentication
- Next.js production checklist: https://nextjs.org/docs/app/guides/production-checklist
- React versions: https://react.dev/versions
- Prisma system requirements: https://docs.prisma.io/docs/orm/reference/system-requirements
- Prisma supported databases: https://docs.prisma.io/docs/orm/reference/supported-databases
- Prisma production migrations: https://docs.prisma.io/docs/cli/migrate/deploy
- Better Auth username plugin: https://better-auth.com/docs/plugins/username
- Better Auth Next.js integration: https://better-auth.com/docs/integrations/next
- daisyUI Next.js installation: https://daisyui.com/docs/install/nextjs/
