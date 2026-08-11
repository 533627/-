# Implementation Plan：公司电商运营终端 V1

状态：已由用户确认  
依据：`docs/spec/company-ops-terminal-v1.md`

## 1. Delivery goal

按照“可运行的基础 → 安全账号体系 → 商业模式与立项 → 项目任务闭环 → 群聊文件 → 统计审计 → 云部署”的依赖顺序，逐个交付可验证的纵向切片。每个任务完成后必须测试、构建并形成独立 Git 提交。

## 2. Architecture decisions

### Application boundary

- 使用单个 Next.js App Router 应用承载页面、Server Actions 和 Route Handlers，V1 不拆微服务。
- 默认服务端渲染数据页面，仅对表单交互、消息刷新、弹窗和即时反馈使用 Client Components。
- PostgreSQL 是唯一业务事实来源；图片和文件只在数据库保存元数据与对象键。

### Authentication and password delivery

- Better Auth 负责会话和密码哈希，用户名插件负责用户名登录。
- 禁止公开注册；账号创建接口只允许最高管理员和运营组长调用。
- Better Auth 所需但员工不使用的邮箱字段由服务端生成内部占位值，不在界面显示，也不用于找回密码。
- 随机密码只存在于创建/重置请求的内存和当次响应中；页面关闭后不可恢复。
- 停用账号时撤销全部会话；所有受保护操作仍重新检查账号状态。

### Authorization

- 角色固定为 `SUPER_ADMIN`、`OPERATIONS_ADMIN`、`DEPARTMENT_MANAGER`、`EMPLOYEE`。
- 权限集中定义为能力函数，不允许页面或接口直接散落角色字符串判断。
- 数据范围与角色权限同时检查，例如部门组长不仅需要 `TASK_ASSIGN` 能力，还必须满足“被派发人属于本部门”。

### Domain model

```text
Department ──< EmployeeProfile ── User/Session
     │                │
     └── DepartmentConversation

BusinessModel ──< ExecutionSuggestion ──< ProjectRequest
      │
      └── Project ──< ProjectMember
             ├── ProjectConversation ──< Message ──< Attachment
             └── Task ──< TaskEvent ──< Attachment
```

### Task state machine

```text
PENDING_ACCEPTANCE → IN_PROGRESS → PENDING_REVIEW → COMPLETED
                           ↑              │
                           └── REWORK ────┘
```

- 状态转换只通过领域函数执行。
- 每次转换同时写入不可变的 `TaskEvent`。
- 只有 `COMPLETED` 计入完成率。

### Messages and files

- V1 使用 3–5 秒轮询、游标分页和已读游标，实现可靠的准实时聊天。
- 部门群成员从部门关系派生；项目群成员由 `ProjectMember` 管理。
- 上传先鉴权，再签发受约束的上传信息；下载前再次检查资源归属和成员关系。

### Audit

- 高价值动作写入仅追加的 `AuditLog`。
- 审计载荷使用字段白名单，禁止密码、会话令牌、对象存储密钥进入日志。

## 3. Dependency graph

```text
Repository + toolchain
  └─ Database + test harness
      └─ Authentication + sessions
          └─ RBAC + departments + accounts
              ├─ Role-aware application shell
              ├─ Business models → requests → projects
              │                         └─ project membership
              └─ Tasks → workflow → review
                                        ├─ notifications/dashboard
                                        └─ audit timeline
Project membership + departments
  └─ conversations → messages → unread state → files
All functional slices
  └─ responsive/accessibility → security review → deployment
```

## 4. Task list

### Phase A — Foundation

#### Task A1：Initialize repository and application skeleton（已完成）

**Description:** 在隔离目录中初始化 Git、Next.js、TypeScript、Tailwind CSS 4、daisyUI 5、ESLint、Vitest 和 Playwright，建立环境变量模板与安全忽略规则。

**Acceptance:**

- [x] 首页、404 和全局错误页可渲染。
- [x] `.env*`、构建产物和上传临时文件不会进入 Git。
- [x] 锁文件固定所有依赖版本。

**Verify:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

**Dependencies:** None  
**Likely files:** `package.json`, `pnpm-lock.yaml`, `.gitignore`, `src/app/*`, `vitest.config.mts`  
**Scope:** M

#### Task A2：Add PostgreSQL and Prisma foundation（已完成）

**Description:** 配置 Prisma、开发/测试数据库连接、健康检查和迁移命令，仅建立系统基础表和默认部门种子。

**Acceptance:**

- [x] 四个默认部门可通过种子脚本重复初始化而不产生重复数据。
- [x] 健康检查能区分应用正常和数据库不可用。
- [x] 初始迁移可在空数据库上完整执行。

**Verify:** `pnpm prisma migrate dev && pnpm test -- database && pnpm build`

**Dependencies:** A1  
**Likely files:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`, `src/app/api/health/route.ts`, `src/lib/db.test.ts`  
**Scope:** M

#### Checkpoint A

- [x] 全部质量命令通过。
- [x] 应用与数据库可在本机启动。
- [x] Git 历史中没有密钥或构建产物。

### Phase B — Authentication, departments, and accounts

#### Task B1：Define and test the permission matrix（已完成）

**Description:** 先建立四类角色、能力枚举、部门作用域规则和负向权限测试，不连接界面。

**Acceptance:**

- [x] 每项能力对四类角色都有明确结果。
- [x] 部门组长不能跨部门管理或派发。
- [x] 运营组长不能创建、重置或停用最高管理员。

**Verify:** `pnpm test -- permissions`

**Dependencies:** A2  
**Likely files:** `src/lib/authz/permissions.ts`, `src/lib/authz/permissions.test.ts`, `src/lib/authz/types.ts`  
**Scope:** S

#### Task B2：Integrate username authentication and sessions（已完成）

**Description:** 配置 Better Auth 用户名登录、会话 Cookie、登录限流和统一错误响应，关闭公开注册入口。

**Acceptance:**

- [x] 有效账号可登录并建立 HttpOnly 会话。
- [x] 无效用户名与错误密码返回相同错误。
- [x] 未登录用户不能访问受保护页面和服务端操作。

**Verify:** `pnpm test -- auth-session && pnpm build`

**Dependencies:** B1  
**Likely files:** `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/features/auth/auth.test.ts`, `src/proxy.ts`  
**Scope:** M

#### Task B3：Create the bootstrap super-admin flow（已完成）

**Description:** 添加一次性运维脚本创建首个最高管理员，密码只输出到运行脚本的终端一次。

**Acceptance:**

- [x] 没有最高管理员时可安全初始化一个账号。
- [x] 已存在最高管理员时脚本拒绝重复创建。
- [x] 数据库和日志中没有明文密码。

**Verify:** `pnpm test -- bootstrap-admin` and manual dry run against test DB

**Dependencies:** B2  
**Likely files:** `scripts/bootstrap-admin.ts`, `src/features/accounts/bootstrap.ts`, `src/features/accounts/bootstrap.test.ts`, `package.json`  
**Scope:** M

#### Task B4：Deliver login and protected application shell（已完成）

**Description:** 实现中文登录页、响应式侧栏/移动导航、当前用户与部门信息，以及按角色显示的导航入口。

**Acceptance:**

- [x] 手机与电脑均可完成登录和退出。
- [x] 登录后默认进入所属部门/角色首页。
- [x] 导航只显示角色可访问模块，直接访问仍由服务端拒绝。

**Verify:** `pnpm test -- --run && pnpm test:e2e && pnpm build`

**Dependencies:** B2, B3  
**Likely files:** `src/app/(auth)/login/page.tsx`, `src/app/(protected)/layout.tsx`, `src/components/app-shell.tsx`, `src/features/auth/login-form.tsx`, `e2e/login.spec.ts`  
**Scope:** M

#### Task B5：Build the password/account terminal（已完成）

**Description:** 纵向实现员工账号列表、创建、部门角色绑定、停用/启用和密码重置；新密码仅在当次成功结果显示。

**Acceptance:**

- [x] 最高管理员和运营组长可操作允许范围内的账号。
- [x] 其他角色访问页面或接口均被拒绝。
- [x] 页面刷新或离开后不能再次取得原密码。
- [x] 停用账号的全部旧会话立即失效。

**Verify:** `pnpm test -- --run && pnpm test:e2e --grep "账号终端" && pnpm build`

**Dependencies:** B4  
**Likely files:** `src/features/accounts/actions.ts`, `src/features/accounts/account-form.tsx`, `src/app/(protected)/accounts/page.tsx`, `src/features/accounts/accounts.test.ts`, `e2e/accounts.spec.ts`  
**Scope:** M

#### Task B6：Add department administration and membership history

**Description:** 实现部门启停、员工调动和部门成员查看，调动时更新部门群访问范围并保留历史留痕。

**Acceptance:**

- [x] 最高管理员可新增或停用部门。
- [x] 有关联数据的部门不能硬删除。
- [x] 部门组长只能看到本部门成员。

**Verify:** `pnpm test -- departments && pnpm build`

**Dependencies:** B5  
**Likely files:** `src/features/departments/actions.ts`, `src/features/departments/department-list.tsx`, `src/app/(protected)/departments/page.tsx`, `src/features/departments/departments.test.ts`  
**Scope:** M

#### Checkpoint B

- [x] 四个角色均有测试账号，权限负向测试通过。
- [x] 管理员可创建账号、复制一次性密码、停用账号。
- [x] 普通员工不能进入账号终端或其他部门空间。

### Phase C — Business models and projects

#### Task C1：Build business model records

**Description:** 实现商业模式的新增、列表、详情、编辑和归档，删除采用有审计记录的受限流程。

**Acceptance:**

- [ ] 只有最高管理员能变更原始内容。
- [ ] 运营组长可查看但不能通过构造请求修改原文。
- [ ] 标签、类目和关键字可筛选。

**Verify:** `pnpm test -- business-models && pnpm test:e2e --grep "商业整理"`

**Dependencies:** B6  
**Likely files:** `src/features/business-models/actions.ts`, `src/features/business-models/model-form.tsx`, `src/app/(protected)/business-models/page.tsx`, `src/app/(protected)/business-models/[id]/page.tsx`, `src/features/business-models/business-models.test.ts`  
**Scope:** M

#### Task C2：Add execution suggestions and project requests

**Description:** 运营组长可在原文旁添加建议并提交立项申请；最高管理员可查看、拒绝或批准。

**Acceptance:**

- [ ] 建议与原文分开保存且不能覆盖原文。
- [ ] 同一申请不能被重复审批。
- [ ] 拒绝必须填写原因并通知申请人。

**Verify:** `pnpm test -- project-requests && pnpm build`

**Dependencies:** C1  
**Likely files:** `src/features/project-requests/actions.ts`, `src/features/project-requests/request-panel.tsx`, `src/app/(protected)/project-requests/page.tsx`, `src/features/project-requests/project-requests.test.ts`  
**Scope:** M

#### Task C3：Convert an approved record into a project

**Description:** 在单个数据库事务中创建项目、来源关联、初始成员和项目协作群，防止半成功状态。

**Acceptance:**

- [ ] 每个已批准申请最多生成一个项目。
- [ ] 项目与原商业模式保持不可丢失的来源关联。
- [ ] 项目创建和协作群创建要么同时成功，要么同时失败。

**Verify:** `pnpm test -- project-conversion`

**Dependencies:** C2  
**Likely files:** `src/features/projects/create-from-model.ts`, `src/features/projects/create-from-model.test.ts`, `prisma/schema.prisma`, generated migration  
**Scope:** M

#### Task C4：Build project detail and member management

**Description:** 实现项目列表、详情、状态、负责人和成员管理，移除成员后立即收回访问权。

**Acceptance:**

- [ ] 最高管理员可增删项目成员和参与部门。
- [ ] 非项目成员不能查看项目详情。
- [ ] 项目状态和成员变更进入时间线。

**Verify:** `pnpm test -- projects && pnpm test:e2e --grep "项目成员"`

**Dependencies:** C3  
**Likely files:** `src/features/projects/actions.ts`, `src/features/projects/member-manager.tsx`, `src/app/(protected)/projects/page.tsx`, `src/app/(protected)/projects/[id]/page.tsx`, `src/features/projects/projects.test.ts`  
**Scope:** M

#### Checkpoint C

- [ ] “记录商业模式 → 运营建议 → 申请立项 → 管理员批准 → 创建项目与群”全流程可运行。
- [ ] 原始内容、建议、审批记录和项目来源均可追溯。

### Phase D — Task assignment and review

#### Task D1：Implement the tested task state machine

**Description:** 先以纯领域逻辑实现允许的状态转换、操作者约束和不可变事件生成。

**Acceptance:**

- [ ] 不允许跳过接收、执行或验收直接完成。
- [ ] 退回必须有原因，重新提交回到待验收。
- [ ] 重复操作安全失败且不产生重复事件。

**Verify:** `pnpm test -- task-state-machine`

**Dependencies:** C4  
**Likely files:** `src/features/tasks/state-machine.ts`, `src/features/tasks/state-machine.test.ts`, `src/features/tasks/types.ts`  
**Scope:** S

#### Task D2：Create and assign tasks

**Description:** 实现项目内创建任务和权限范围内派发，包含优先级、负责人、截止时间与说明。

**Acceptance:**

- [ ] 最高管理员和运营组长可跨部门派发。
- [ ] 部门组长只能派给本部门员工。
- [ ] 普通员工不能派发任务或伪造派发人。

**Verify:** `pnpm test -- task-assignment && pnpm build`

**Dependencies:** D1  
**Likely files:** `src/features/tasks/actions.ts`, `src/features/tasks/task-form.tsx`, `src/app/(protected)/projects/[id]/tasks/page.tsx`, `src/features/tasks/task-assignment.test.ts`  
**Scope:** M

#### Task D3：Deliver employee task execution

**Description:** 实现“我的待办”、接收、开始、提交说明与成果的员工路径。

**Acceptance:**

- [ ] 员工只能操作分配给自己的任务。
- [ ] 每次状态变化生成时间和操作者记录。
- [ ] 逾期状态由截止时间计算，不能由客户端伪造。

**Verify:** `pnpm test -- task-execution && pnpm test:e2e --grep "提交任务"`

**Dependencies:** D2  
**Likely files:** `src/features/tasks/my-task-list.tsx`, `src/features/tasks/task-detail.tsx`, `src/app/(protected)/my-tasks/page.tsx`, `src/features/tasks/task-execution.test.ts`, `e2e/task-execution.spec.ts`  
**Scope:** M

#### Task D4：Deliver review, rejection, and completion metrics

**Description:** 实现派发人/上级的验收与退回，并基于已验收任务计算完成率。

**Acceptance:**

- [ ] 非派发人或更高权限者不能验收。
- [ ] 退回原因对员工可见，再次提交完整留痕。
- [ ] 只有 `COMPLETED` 计入完成率。

**Verify:** `pnpm test -- task-review && pnpm test:e2e --grep "任务验收"`

**Dependencies:** D3  
**Likely files:** `src/features/tasks/review-actions.ts`, `src/features/tasks/review-panel.tsx`, `src/app/(protected)/reviews/page.tsx`, `src/features/tasks/task-review.test.ts`, `e2e/task-review.spec.ts`  
**Scope:** M

#### Checkpoint D

- [ ] 管理者派发、员工执行、提交、退回、再提交、验收的完整 E2E 通过。
- [ ] 越权与非法状态转换测试全部通过。

### Phase E — Conversations and files

#### Task E1：Build department and project conversation access

**Description:** 建立部门群和项目群查询、成员派生及服务端访问校验。

**Acceptance:**

- [ ] 每个部门和项目各有且仅有一个对应群。
- [ ] 非成员不能读取群信息或消息。
- [ ] 员工调动或项目移除后不能访问后续内容。

**Verify:** `pnpm test -- conversation-access`

**Dependencies:** C4, B6  
**Likely files:** `src/features/chat/access.ts`, `src/features/chat/access.test.ts`, `prisma/schema.prisma`, generated migration  
**Scope:** M

#### Task E2：Add text messages, pagination, and unread state

**Description:** 实现发送文字、游标分页、3–5 秒刷新、未读数和已读位置。

**Acceptance:**

- [ ] 消息顺序稳定且分页无重复、无漏项。
- [ ] 未读数量在打开群后正确清零。
- [ ] 伪造群 ID 不能发送或读取消息。

**Verify:** `pnpm test -- messages && pnpm test:e2e --grep "群聊"`

**Dependencies:** E1  
**Likely files:** `src/features/chat/actions.ts`, `src/features/chat/conversation-view.tsx`, `src/app/(protected)/messages/[id]/page.tsx`, `src/features/chat/messages.test.ts`, `e2e/chat.spec.ts`  
**Scope:** M

#### Task E3：Add message recall and audit behavior

**Description:** 支持发送者短时间撤回消息，保留占位和不可删除审计事件。

**Acceptance:**

- [ ] 只有发送者可在规定时间内撤回。
- [ ] 撤回后其他成员看到“消息已撤回”，看不到原内容。
- [ ] 审计日志不保存原消息的敏感附件地址。

**Verify:** `pnpm test -- message-recall`

**Dependencies:** E2  
**Likely files:** `src/features/chat/recall.ts`, `src/features/chat/message-item.tsx`, `src/features/chat/message-recall.test.ts`  
**Scope:** S

#### Task E4：Implement secure file upload and download

**Description:** 接入 S3 兼容存储抽象，完成类型/大小校验、随机对象键、归属记录和鉴权下载。

**Acceptance:**

- [ ] 非允许类型或超过 20 MB 的文件被服务端拒绝。
- [ ] 无权用户不能获得下载签名地址。
- [ ] 图片可预览，其他文件可安全下载。

**Verify:** `pnpm test -- file-access && pnpm test:e2e --grep "上传附件"`

**Dependencies:** E2, D3, C1  
**Likely files:** `src/lib/storage.ts`, `src/features/files/actions.ts`, `src/features/files/file-input.tsx`, `src/features/files/files.test.ts`, `e2e/files.spec.ts`  
**Scope:** M

#### Checkpoint E

- [ ] 部门群和项目群的文字、图片、文件、未读与撤回流程可运行。
- [ ] 跨群、跨部门、跨项目文件访问全部被拒绝。

### Phase F — Notifications, dashboards, and audit

#### Task F1：Add in-app notifications

**Description:** 对任务、验收、立项和项目成员事件生成站内通知及未读计数。

**Acceptance:**

- [ ] 同一业务事件不会重复生成通知。
- [ ] 用户只能读取和标记自己的通知。
- [ ] 顶部未读数量与通知列表一致。

**Verify:** `pnpm test -- notifications`

**Dependencies:** C4, D4  
**Likely files:** `src/features/notifications/service.ts`, `src/features/notifications/notification-menu.tsx`, `src/app/(protected)/notifications/page.tsx`, `src/features/notifications/notifications.test.ts`  
**Scope:** M

#### Task F2：Build role-aware dashboards

**Description:** 按角色聚合项目、任务、待验收、逾期和部门工作量，普通员工只看到自己的待办。

**Acceptance:**

- [ ] 四类角色的首页数据范围正确。
- [ ] 完成率仅基于验收完成任务。
- [ ] 常用统计查询有索引并使用分页或有界时间范围。

**Verify:** `pnpm test -- dashboards && pnpm build`

**Dependencies:** F1, D4  
**Likely files:** `src/features/dashboard/queries.ts`, `src/features/dashboard/dashboard-view.tsx`, `src/app/(protected)/page.tsx`, `src/features/dashboard/dashboard.test.ts`  
**Scope:** M

#### Task F3：Deliver the immutable audit viewer

**Description:** 聚合高价值安全与业务事件，为最高管理员提供可筛选、只读的审计页面。

**Acceptance:**

- [ ] 只有最高管理员能读取审计页面和接口。
- [ ] 审计记录不能从应用界面修改或删除。
- [ ] 密码、令牌、存储密钥和签名 URL 不进入审计载荷。

**Verify:** `pnpm test -- audit-log && pnpm test:e2e --grep "审计"`

**Dependencies:** B5, C4, D4, E3  
**Likely files:** `src/lib/audit.ts`, `src/features/audit/audit-table.tsx`, `src/app/(protected)/audit/page.tsx`, `src/features/audit/audit.test.ts`, `e2e/audit.spec.ts`  
**Scope:** M

#### Checkpoint F

- [ ] 老板首页能回答“哪个项目、谁负责、到哪一步、是否逾期、是否验收”。
- [ ] 关键账号与业务动作均能在审计页追溯。

### Phase G — Quality, security, and deployment

#### Task G1：Complete responsive and accessibility review

**Description:** 在 320、768、1024、1440 像素下逐页检查导航、表单、表格、聊天和任务流程，并完成键盘与可访问名称修复。

**Acceptance:**

- [ ] 关键流程无横向溢出、遮挡或不可点击控件。
- [ ] 所有表单有可见标签，状态同时使用文字/图标表达。
- [ ] 键盘可完成登录、派发、提交和验收。

**Verify:** Playwright viewport suite, accessibility scan, manual screenshot review

**Dependencies:** F3, E4  
**Likely files:** `e2e/responsive.spec.ts`, `e2e/accessibility.spec.ts`, affected component files in small focused commits  
**Scope:** M per focused fix

#### Task G2：Run security hardening and abuse-case suite

**Description:** 验证所有信任边界，加入安全响应头、登录限流、输入上限、会话撤销和越权回归测试。

**Acceptance:**

- [ ] 所有受保护操作均有服务端授权测试。
- [ ] 安全响应头存在，错误不暴露堆栈。
- [ ] `pnpm audit` 无可达的高危或严重漏洞。

**Verify:** `pnpm test -- security && pnpm audit --prod && pnpm build`

**Dependencies:** G1  
**Likely files:** `next.config.ts`, `src/lib/security.ts`, `src/features/security/security.test.ts`, selected route/action files  
**Scope:** M per focused fix

#### Task G3：Package production deployment

**Description:** 提供容器化部署、环境变量清单、数据库迁移、备份/恢复步骤、HTTPS 反向代理说明和健康检查。

**Acceptance:**

- [ ] 全新环境可按文档部署并初始化最高管理员。
- [ ] 部署使用 `prisma migrate deploy`，不在生产执行破坏性开发迁移。
- [ ] 数据库每日备份并有一次恢复演练记录。

**Verify:** clean-environment deployment rehearsal and post-deploy smoke test

**Dependencies:** G2 and selected cloud/storage provider  
**Likely files:** `Dockerfile`, `compose.yaml`, `.env.example`, `docs/deployment.md`, deployment scripts  
**Scope:** M

#### Task G4：Final acceptance and release candidate

**Description:** 执行完整回归、关键 E2E、性能抽查、备份恢复和 V1 验收清单，形成可发布候选版本。

**Acceptance:**

- [ ] 规格第 13 节的每项验收标准均有证据。
- [ ] 全部测试、类型检查、Lint 和生产构建通过。
- [ ] 已知限制和后续功能明确记录。

**Verify:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`

**Dependencies:** G3  
**Likely files:** `docs/release/v1-acceptance.md`, `CHANGELOG.md`, focused fixes only  
**Scope:** M

## 5. Verification cadence

- 每个任务：运行该功能的定向测试。
- 每 2–3 个任务：运行全部单元/集成测试、类型检查和构建。
- 每个阶段检查点：运行相关 E2E 并人工检查关键页面。
- 每个成功切片：检查差异、扫描潜在密钥、形成原子提交。
- 功能开发完成：真实浏览器检查控制台、网络请求、响应式布局和键盘操作。

## 6. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 运营组长跨部门权限过大 | High | 所有高权限动作写审计；禁止其管理最高管理员；负向权限测试先行 |
| 一次性密码被截图或转发 | High | 只显示一次；不写日志；建议线下安全交付；管理员可立即重置 |
| 账号停用后旧会话仍有效 | High | 停用时撤销全部会话，每次服务端操作再次检查账号状态 |
| 群聊或附件跨部门泄露 | High | 查询与下载双重成员校验；随机对象键；短期签名地址；越权测试 |
| 轮询造成数据库压力 | Medium | 增量游标、只取新消息、页面不可见时降频、消息表复合索引 |
| 商业模式转项目半成功 | High | 单数据库事务和唯一约束，失败整体回滚 |
| 任务状态被重复点击破坏 | Medium | 状态机、乐观并发条件和幂等测试 |
| 云供应商尚未确定 | Medium | 使用 PostgreSQL 与 S3 标准接口，本地实现不绑定厂商 |
| 手机表格和复杂表单难用 | Medium | 移动端优先使用列表/抽屉，阶段 G 前每个切片都做基本响应式检查 |

## 7. Decisions deferred until deployment

- 公司名称、Logo、品牌主色。
- 云服务器与对象存储厂商。
- 正式域名及中国大陆备案安排。
- 备份保存地区、预算和保留周期是否超过 14 天。

这些决定不阻塞 A–F 阶段的本地开发；G3 部署前必须确认。

## 8. Definition of done

- 已确认规格的所有 V1 验收标准通过。
- 每个新行为都有对应自动化测试，无禁用或跳过测试。
- 生产构建、Lint、类型检查、单元/集成测试和关键 E2E 全部通过。
- 服务端权限、账号停用、一次性密码、群聊和文件隔离均有负向测试。
- 手机和电脑浏览器可完成关键闭环。
- 部署、备份、恢复、初始化管理员和常见运维流程有文档。
