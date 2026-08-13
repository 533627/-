import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { username } from "better-auth/plugins";

import {
  AUTH_DISABLED_PATHS,
  AUTH_RATE_LIMIT,
  readAuthEnvironment,
  USERNAME_POLICY,
} from "@/lib/auth-policy";
import { getDatabase } from "@/lib/db";

const environment = readAuthEnvironment();

export const auth = betterAuth({
  appName: "商序终端",
  baseURL: environment.BETTER_AUTH_URL,
  secret: environment.BETTER_AUTH_SECRET,
  database: prismaAdapter(getDatabase(), {
    provider: "postgresql",
  }),
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await getDatabase().user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });

          if (!user?.isActive) {
            throw new APIError("UNAUTHORIZED", {
              message: "Invalid username or password.",
            });
          }

          return { data: session };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  disabledPaths: [...AUTH_DISABLED_PATHS],
  rateLimit: AUTH_RATE_LIMIT,
  advanced: {
    cookiePrefix: "company-ops",
  },
  plugins: [username(USERNAME_POLICY)],
});
