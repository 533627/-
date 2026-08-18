import pg from "pg";

const LEGACY_TASK_SUBTASKS_MIGRATION = "20260815063000_add_task_subtasks";

export async function prepareProductionMigrationRepair({ databaseUrl }) {
  if (!databaseUrl || databaseUrl === "[SENSITIVE]") {
    return [];
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const migrationState = await readMigrationState(client);

    if (migrationState?.applied) {
      return [];
    }

    const schemaState = await readTaskSubtasksSchemaState(client);
    const shouldRepairTaskSubtasksMigration =
      migrationState?.failed ||
      schemaState.startsAtExists ||
      schemaState.taskSubtasksTableExists;

    if (!shouldRepairTaskSubtasksMigration) {
      return [];
    }

    await repairTaskSubtasksMigration(client);
    return [LEGACY_TASK_SUBTASKS_MIGRATION];
  } finally {
    await client.end();
  }
}

async function readMigrationState(client) {
  try {
    const result = await client.query(
      `
        SELECT
          "finished_at" IS NOT NULL AS "applied",
          "rolled_back_at" IS NULL AND "finished_at" IS NULL AS "failed"
        FROM "_prisma_migrations"
        WHERE "migration_name" = $1
        ORDER BY "started_at" DESC
        LIMIT 1
      `,
      [LEGACY_TASK_SUBTASKS_MIGRATION],
    );

    return result.rows[0] ?? null;
  } catch (error) {
    if (error?.code === "42P01") {
      return null;
    }

    throw error;
  }
}

async function readTaskSubtasksSchemaState(client) {
  const result = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'startsAt'
      ) AS "startsAtExists",
      to_regclass('public.task_subtasks') IS NOT NULL AS "taskSubtasksTableExists"
  `);

  return result.rows[0];
}

async function repairTaskSubtasksMigration(client) {
  await client.query("BEGIN");

  try {
    await client.query(`
      ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMPTZ(3)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "task_subtasks" (
        "id" UUID NOT NULL,
        "taskId" UUID NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "position" INTEGER NOT NULL,
        "isCompleted" BOOLEAN NOT NULL DEFAULT false,
        "completedAt" TIMESTAMPTZ(3),
        "completedById" TEXT,
        "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(3) NOT NULL,
        CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "task_subtasks_taskId_position_key"
      ON "task_subtasks"("taskId", "position")
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "task_subtasks_taskId_isCompleted_idx"
      ON "task_subtasks"("taskId", "isCompleted")
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "task_subtasks_completedById_idx"
      ON "task_subtasks"("completedById")
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'task_subtasks_taskId_fkey'
        ) THEN
          ALTER TABLE "task_subtasks"
          ADD CONSTRAINT "task_subtasks_taskId_fkey"
          FOREIGN KEY ("taskId")
          REFERENCES "tasks"("id")
          ON DELETE CASCADE
          ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'task_subtasks_completedById_fkey'
        ) THEN
          ALTER TABLE "task_subtasks"
          ADD CONSTRAINT "task_subtasks_completedById_fkey"
          FOREIGN KEY ("completedById")
          REFERENCES "user"("id")
          ON DELETE RESTRICT
          ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
