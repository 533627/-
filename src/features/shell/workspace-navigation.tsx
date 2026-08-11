"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceNavigationItem } from "@/features/shell/navigation";

export function WorkspaceDrawerButton() {
  return (
    <button
      aria-label="打开菜单"
      className="btn btn-ghost btn-sm drawer-button lg:hidden"
      onClick={() => {
        const drawer = document.querySelector<HTMLInputElement>(
          "#workspace-drawer",
        );
        drawer?.click();
      }}
      type="button"
    >
      菜单
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
    <ul className="menu menu-md w-full gap-1" aria-label="工作区导航">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <Link
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "menu-active font-medium" : undefined}
              href={item.href}
              onClick={() => {
                const drawer = document.querySelector<HTMLInputElement>(
                  "#workspace-drawer",
                );
                if (drawer?.checked) drawer.click();
              }}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
