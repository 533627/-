import { describe, expect, it, vi } from "vitest";

import { loadCurrentUser } from "@/features/auth/current-user";

describe("loadCurrentUser", () => {
  it("returns null without querying user data when the session is missing", async () => {
    const findUser = vi.fn();

    await expect(
      loadCurrentUser(
        { getSession: async () => null, findUser },
        new Headers(),
      ),
    ).resolves.toBeNull();
    expect(findUser).not.toHaveBeenCalled();
  });

  it("returns only the current user's shell identity", async () => {
    await expect(
      loadCurrentUser(
        {
          getSession: async () => ({ user: { id: "user-1" } }),
          findUser: async () => ({
            id: "user-1",
            name: "运营组长",
            username: "ops.lead",
            displayUsername: "ops.lead",
            role: "OPERATIONS_ADMIN",
            isActive: true,
            department: { id: "dept-1", name: "运营部" },
          }),
        },
        new Headers(),
      ),
    ).resolves.toEqual({
      id: "user-1",
      name: "运营组长",
      username: "ops.lead",
      role: "OPERATIONS_ADMIN",
      department: { id: "dept-1", name: "运营部" },
    });
  });

  it("rejects an orphaned session whose user no longer exists", async () => {
    await expect(
      loadCurrentUser(
        {
          getSession: async () => ({ user: { id: "missing-user" } }),
          findUser: async () => null,
        },
        new Headers(),
      ),
    ).resolves.toBeNull();
  });

  it("rejects a session belonging to a deactivated account", async () => {
    await expect(
      loadCurrentUser(
        {
          getSession: async () => ({ user: { id: "disabled-user" } }),
          findUser: async () => ({
            id: "disabled-user",
            name: "停用员工",
            username: "disabled.user",
            displayUsername: "disabled.user",
            role: "EMPLOYEE",
            isActive: false,
            department: { id: "dept-1", name: "运营部" },
          }),
        },
        new Headers(),
      ),
    ).resolves.toBeNull();
  });
});
