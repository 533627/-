import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/current-user-server";
import { LoginForm } from "@/features/auth/login-form";
import { appConfig } from "@/lib/app-config";

export const metadata: Metadata = {
  title: "登录",
};

const workflow = [
  "记录可执行的商业模式",
  "把项目交给对应部门",
  "跟进任务提交与验收",
  "保留跨部门协作过程",
] as const;

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="grid min-h-[100dvh] bg-base-200 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="hidden bg-neutral p-10 text-neutral-content lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="flex items-center gap-3">
          <Image alt="" aria-hidden="true" className="size-12 object-contain" height={48} src="/brand-logo.png" width={48} />
          <div>
            <p className="font-semibold">{appConfig.name}</p>
            <p className="mt-1 text-sm text-neutral-content/65">
              公司内部运营平台
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            把好项目变成清晰的下一步。
          </h2>
          <ol className="mt-10 grid gap-4" aria-label="平台工作闭环">
            {workflow.map((item, index) => (
              <li
                className="grid grid-cols-[2rem_1fr] items-center border-b border-neutral-content/15 pb-4"
                key={item}
              >
                <span className="text-sm tabular-nums text-neutral-content/45">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="max-w-md text-sm leading-6 text-neutral-content/60">
          账号由最高管理员或运营组长统一发放。终端不开放公开注册。
        </p>
      </aside>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image alt="" aria-hidden="true" className="size-10 object-contain" height={40} src="/brand-logo.png" width={40} />
            <div>
              <p className="font-semibold">{appConfig.name}</p>
              <p className="text-xs text-base-content/60">公司内部运营平台</p>
            </div>
          </div>

          <div className="card card-border bg-base-100">
            <div className="card-body p-6 sm:p-8">
              <div>
                <p className="text-sm font-medium text-base-content/60">
                  欢迎回来
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  登录商序终端
                </h1>
                <p className="mt-3 leading-6 text-base-content/65">
                  进入你的部门工作区，查看任务、项目和协作消息。
                </p>
              </div>
              <LoginForm />
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-base-content/55">
            无法登录时，请联系最高管理员或运营组长重置密码。
          </p>
        </div>
      </section>
    </main>
  );
}
