import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("username authentication database integration", () => {
  const username = `auth_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const password = "StrongPassword123!";
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl! }),
  });
  let auth: (typeof import("@/lib/auth"))["auth"];

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.BETTER_AUTH_SECRET = "integration-test-secret-with-at-least-32-characters";

    ({ auth } = await import("@/lib/auth"));

    const userId = randomUUID();
    await database.user.create({
      data: {
        id: userId,
        name: "认证测试账号",
        email: `${username}@internal.invalid`,
        emailVerified: true,
        username,
        displayUsername: username,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: await hashPassword(password),
          },
        },
      },
    });
  });

  afterAll(async () => {
    await database.user.deleteMany({ where: { username } });
    await database.rateLimit.deleteMany();
    await database.$disconnect();
  });

  it("rejects public registration", async () => {
    const response = await auth.handler(
      authRequest("/sign-up/email", {
        email: "public-registration@internal.invalid",
        name: "Public registration",
        password,
        username: "public_registration",
      }),
    );

    expect(response.status).not.toBe(200);
    expect(
      await database.user.findUnique({
        where: { email: "public-registration@internal.invalid" },
      }),
    ).toBeNull();
  });

  it("returns the same public error for an unknown username and a wrong password", async () => {
    const unknownUserResponse = await auth.handler(
      authRequest(
        "/sign-in/username",
        { username: "missing_user", password },
        "203.0.113.10",
      ),
    );
    const wrongPasswordResponse = await auth.handler(
      authRequest(
        "/sign-in/username",
        { username, password: "WrongPassword123!" },
        "203.0.113.11",
      ),
    );

    expect({
      status: unknownUserResponse.status,
      body: await unknownUserResponse.json(),
    }).toEqual({
      status: wrongPasswordResponse.status,
      body: await wrongPasswordResponse.json(),
    });
  });

  it("creates a database-backed session for valid credentials", async () => {
    const signInResponse = await auth.handler(
      authRequest(
        "/sign-in/username",
        { username, password },
        "203.0.113.20",
      ),
    );
    const cookie = signInResponse.headers.get("set-cookie")?.split(";", 1)[0];

    expect(signInResponse.status).toBe(200);
    expect(cookie).toBeTruthy();
    expect(signInResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(signInResponse.headers.get("set-cookie")).toContain("SameSite=Lax");

    const sessionResponse = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie: cookie! },
      }),
    );
    const session = await sessionResponse.json();

    expect(session.user).toMatchObject({ username });
    expect(session.session).toBeTruthy();
  });

  it("rejects a protected server operation without a session", async () => {
    const { getRequiredSession } = await import("@/lib/auth-session-server");

    await expect(getRequiredSession(new Headers())).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("rate limits repeated username login attempts", async () => {
    const responses = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(
        await auth.handler(
          authRequest(
            "/sign-in/username",
            { username: "rate_limited_user", password },
            "203.0.113.30",
          ),
        ),
      );
    }

    expect(responses.slice(0, 5).every(({ status }) => status !== 429)).toBe(true);
    expect(responses[5].status).toBe(429);
    expect(responses[5].headers.get("x-retry-after")).toBeTruthy();
  });
});

function authRequest(
  path: string,
  body: Record<string, string>,
  ipAddress = "203.0.113.1",
) {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-for": ipAddress,
    },
    body: JSON.stringify(body),
  });
}
