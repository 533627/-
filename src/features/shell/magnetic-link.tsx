"use client";

import Link from "next/link";
import { useRef, type PointerEvent } from "react";

export function MagneticLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className: string;
  href: string;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  function followPointer(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType !== "mouse" || !linkRef.current) return;
    const rect = linkRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * 0.18;
    const y = (event.clientY - rect.top - rect.height / 2) * 0.22;
    linkRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function resetPosition() {
    if (linkRef.current) linkRef.current.style.transform = "translate3d(0, 0, 0)";
  }

  return (
    <Link
      className={className}
      href={href}
      onPointerLeave={resetPosition}
      onPointerMove={followPointer}
      ref={linkRef}
    >
      {children}
    </Link>
  );
}
