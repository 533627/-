export function assertDedicatedTestDatabase(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
) {
  if (!testDatabaseUrl) return;
  if (!applicationDatabaseUrl) return;

  const testTarget = databaseTarget(testDatabaseUrl);
  const applicationTarget = databaseTarget(applicationDatabaseUrl);
  if (testTarget === applicationTarget) {
    throw new Error(
      "TEST_DATABASE_URL must point to a dedicated test database, not DATABASE_URL.",
    );
  }
}

export function bootstrapTestUserFilter() {
  return {
    role: "SUPER_ADMIN" as const,
    username: { startsWith: "bootstrap_test_" },
  };
}

export function requireDedicatedTestDatabase(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
) {
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required for browser tests.");
  }
  assertDedicatedTestDatabase(testDatabaseUrl, applicationDatabaseUrl);
}

function databaseTarget(value: string) {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`;
}
