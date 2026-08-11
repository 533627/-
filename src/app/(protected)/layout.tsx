import { requireCurrentUser } from "@/features/auth/current-user-server";
import { AppShell } from "@/features/shell/app-shell";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireCurrentUser();

  return <AppShell user={user}>{children}</AppShell>;
}
