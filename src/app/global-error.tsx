"use client";

import "./globals.css";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="zh-CN" data-theme="corporate">
      <body>
        <main className="grid min-h-screen place-items-center bg-base-200 px-4">
          <section className="card card-border w-full max-w-md bg-base-100">
            <div className="card-body">
              <div role="alert" className="alert alert-error alert-soft">
                系统暂时无法完成这次操作
              </div>
              <h1 className="card-title mt-2">请稍后再试</h1>
              <p className="text-base-content/70">
                如果问题持续出现，请联系系统管理员并说明操作时间。
              </p>
              <div className="card-actions mt-3">
                <button className="btn" onClick={retry} type="button">
                  重新尝试
                </button>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
