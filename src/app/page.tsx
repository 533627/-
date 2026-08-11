import { appConfig } from "@/lib/app-config";

const workflow = [
  "沉淀商业模式",
  "确认项目立项",
  "跨部门派发任务",
  "提交成果并验收",
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-base-200">
      <header className="navbar border-b border-base-300 bg-base-100 px-4 sm:px-6 lg:px-10">
        <div className="navbar-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-field bg-neutral font-semibold text-neutral-content"
          >
            商
          </span>
          <div>
            <p className="font-semibold leading-tight">{appConfig.name}</p>
            <p className="text-xs text-base-content/60">公司内部运营平台</p>
          </div>
        </div>
        <div className="navbar-end">
          <span className="badge badge-soft">基础框架已就绪</span>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.35fr_0.65fr] lg:px-10">
        <section aria-labelledby="page-title" className="max-w-3xl">
          <p className="mb-4 text-sm font-medium tracking-wide text-base-content/60">
            商业整理 · 项目推进 · 部门协作
          </p>
          <h1
            id="page-title"
            className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
          >
            让每一个电商项目，都有清晰的负责人和下一步。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-base-content/70 sm:text-lg">
            从老板记录商业模式，到运营立项、跨部门执行和最终验收，所有信息都在同一个终端内持续留痕。
          </p>

          <ol className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="项目闭环流程">
            {workflow.map((item, index) => (
              <li
                className="flex items-center gap-3 border-l-2 border-base-300 py-2 pl-3"
                key={item}
              >
                <span className="text-sm tabular-nums text-base-content/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="card card-border bg-base-100" aria-labelledby="build-status">
          <div className="card-body">
            <span className="badge badge-success badge-soft w-fit">A1 已完成</span>
            <h2 className="card-title mt-2" id="build-status">
              平台基础环境
            </h2>
            <p className="text-sm leading-6 text-base-content/70">
              当前正在建立安全账号体系所需的项目基础。下一阶段将交付登录、部门权限和密码终端。
            </p>
            <div className="mt-4 border-t border-base-300 pt-4">
              <p className="text-sm font-medium">首批核心模块</p>
              <ul className="mt-3 space-y-2 text-sm text-base-content/70">
                <li>商业模式整理与立项</li>
                <li>任务派发、提交与验收</li>
                <li>部门群与项目协作群</li>
              </ul>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
