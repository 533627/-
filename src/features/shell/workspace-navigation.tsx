"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceNavigationItem } from "@/features/shell/navigation";

export function WorkspaceDrawerButton() {
  return (
    <button
      aria-label="打开菜单"
      className="btn btn-ghost btn-square btn-sm drawer-button lg:hidden"
      onClick={() => {
        const drawer = document.querySelector<HTMLInputElement>(
          "#workspace-drawer",
        );
        drawer?.click();
      }}
      type="button"
    >
      <span aria-hidden="true" className="text-lg leading-none">☰</span>
    </button>
  );
}

export function WorkspaceNavigation({
  items,
}: {
  items: readonly WorkspaceNavigationItem[];
}) {
  const pathname = usePathname();

  return (
    <ul className="menu menu-md w-full gap-1.5 p-0" aria-label="工作区导航">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "menu-active gap-3 bg-primary! px-3 py-2.5 font-medium text-primary-content!"
                  : "gap-3 px-3 py-2.5 text-neutral-content/70 hover:bg-neutral-content/8 hover:text-neutral-content"
              }
              href={item.href}
              onClick={() => {
                const drawer = document.querySelector<HTMLInputElement>(
                  "#workspace-drawer",
                );
                if (drawer?.checked) drawer.click();
              }}
            >
              <span
                aria-hidden="true"
                className={
                  isActive
                    ? "grid size-7 place-items-center rounded-selector bg-primary-content/14 text-xs"
                    : "grid size-7 place-items-center rounded-selector bg-neutral-content/8 text-xs text-neutral-content/65"
                }
              >
                {item.marker}
              </span>
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
