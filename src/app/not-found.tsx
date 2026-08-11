import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-base-200 px-4">
      <section className="card card-border w-full max-w-md bg-base-100 text-center">
        <div className="card-body items-center">
          <span className="badge badge-warning badge-soft">404</span>
          <h1 className="card-title mt-2">没有找到这个页面</h1>
          <p className="text-base-content/70">
            页面可能已经移动，或者你输入的地址不正确。
          </p>
          <div className="card-actions mt-3">
            <Link className="btn" href="/">
              返回首页
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
