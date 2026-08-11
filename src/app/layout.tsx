import type { Metadata } from "next";

import { appConfig } from "@/lib/app-config";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s · ${appConfig.name}`,
  },
  description: appConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="corporate">
      <body className="antialiased">{children}</body>
    </html>
  );
}
