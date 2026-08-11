import { z } from "zod";

export const AUTH_DISABLED_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/is-username-available",
  "/request-password-reset",
  "/reset-password",
] as const;

export const AUTH_RATE_LIMIT = {
  enabled: true,
  storage: "database",
  window: 60,
  max: 100,
  customRules: {
    "/sign-in/username": {
      window: 60,
      max: 5,
    },
  },
} as const;

export const USERNAME_POLICY = {
  minUsernameLength: 3,
  maxUsernameLength: 30,
  usernameValidator: (username: string) => /^[a-zA-Z0-9_.]+$/.test(username),
  usernameNormalization: (username: string) => username.toLowerCase(),
} as const;

const authEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }),
});

export function readAuthEnvironment(
  environment: Record<string, string | undefined> = process.env,
) {
  return authEnvironmentSchema.parse(environment);
}
