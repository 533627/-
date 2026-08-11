import { randomBytes } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

const bootstrapAdminInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/)
    .transform((username) => username.toLowerCase()),
  name: z.string().trim().min(1).max(100),
});

export type BootstrapAdminStore = {
  createFirstSuperAdmin(input: {
    name: string;
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<"created" | "already_exists">;
};

type BootstrapAdminDependencies = {
  generatePassword: () => string;
  hashPassword: (password: string) => Promise<string>;
};

export class BootstrapAdminError extends Error {
  constructor(
    public readonly code:
      | "INVALID_BOOTSTRAP_INPUT"
      | "SUPER_ADMIN_ALREADY_EXISTS"
      | "INVALID_GENERATED_PASSWORD",
    message: string,
  ) {
    super(message);
    this.name = "BootstrapAdminError";
  }
}

export function generateTemporaryPassword() {
  return randomBytes(24).toString("base64url");
}

export async function bootstrapSuperAdmin(
  store: BootstrapAdminStore,
  input: { username: string; name: string },
  dependencies: BootstrapAdminDependencies = {
    generatePassword: generateTemporaryPassword,
    hashPassword,
  },
) {
  const parsedInput = bootstrapAdminInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new BootstrapAdminError(
      "INVALID_BOOTSTRAP_INPUT",
      "Username or display name is invalid.",
    );
  }

  const password = dependencies.generatePassword();
  if (password.length < 12 || password.length > 128) {
    throw new BootstrapAdminError(
      "INVALID_GENERATED_PASSWORD",
      "The generated password does not meet the authentication policy.",
    );
  }

  const { name, username } = parsedInput.data;
  const result = await store.createFirstSuperAdmin({
    name,
    username,
    email: `${username}@internal.invalid`,
    passwordHash: await dependencies.hashPassword(password),
  });

  if (result === "already_exists") {
    throw new BootstrapAdminError(
      "SUPER_ADMIN_ALREADY_EXISTS",
      "A super administrator already exists.",
    );
  }

  return { username, password };
}
