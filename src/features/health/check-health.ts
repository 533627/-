type HealthBody =
  | {
      status: "ok";
      checks: { database: "ok" };
      checkedAt: string;
    }
  | {
      status: "degraded";
      checks: { database: "unavailable" };
      checkedAt: string;
    };

type HealthFailureEvent = {
  event: "health_check_failed";
  requestId: string;
  component: "database";
  errorName: string;
};

type HealthDependencies = {
  checkDatabase: () => Promise<void>;
  checkedAt?: () => Date;
  logFailure: (event: HealthFailureEvent) => void;
  requestId: string;
};

export async function checkHealth({
  checkDatabase,
  checkedAt = () => new Date(),
  logFailure,
  requestId,
}: HealthDependencies): Promise<{ body: HealthBody; status: 200 | 503 }> {
  const timestamp = checkedAt().toISOString();

  try {
    await checkDatabase();

    return {
      body: {
        status: "ok",
        checks: { database: "ok" },
        checkedAt: timestamp,
      },
      status: 200,
    };
  } catch (error) {
    logFailure({
      event: "health_check_failed",
      requestId,
      component: "database",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      body: {
        status: "degraded",
        checks: { database: "unavailable" },
        checkedAt: timestamp,
      },
      status: 503,
    };
  }
}
