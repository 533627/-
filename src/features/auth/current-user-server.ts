import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadCurrentUser } from "@/features/auth/current-user";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const getCurrentUser = cache(async () => {
  const requestHeaders = await headers();

  return loadCurrentUser(
    {
      getSession: (sessionHeaders) =>
        auth.api.getSession({ headers: sessionHeaders }),
      findUser: (userId) =>
        getDatabase().user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            role: true,
            department: {
              select: { id: true, name: true },
            },
          },
        }),
    },
    requestHeaders,
  );
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
