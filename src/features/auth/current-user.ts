import type { OperationsTeam, Role } from "@/lib/authz/types";

type ShellUserRecord = {
  id: string;
  name: string;
  username: string | null;
  displayUsername: string | null;
  role: Role;
  operationsTeam: OperationsTeam | null;
  isActive: boolean;
  department: { id: string; name: string } | null;
};

type CurrentUserDependencies = {
  getSession: (
    headers: Headers,
  ) => Promise<{ user: { id: string } } | null>;
  findUser: (userId: string) => Promise<ShellUserRecord | null>;
};

export type CurrentUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  operationsTeam: OperationsTeam | null;
  department: { id: string; name: string } | null;
};

export async function loadCurrentUser(
  dependencies: CurrentUserDependencies,
  headers: Headers,
): Promise<CurrentUser | null> {
  const session = await dependencies.getSession(headers);

  if (!session) {
    return null;
  }

  const user = await dependencies.findUser(session.user.id);

  if (!user || !user.isActive) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.displayUsername ?? user.username ?? user.name,
    role: user.role,
    operationsTeam: user.operationsTeam,
    department: user.department,
  };
}
