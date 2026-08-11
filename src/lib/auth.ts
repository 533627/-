import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
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
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
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
