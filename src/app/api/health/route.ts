import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { checkHealth } from "@/features/health/check-health";
import { checkDatabaseConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = randomUUID();
  const result = await checkHealth({
    checkDatabase: checkDatabaseConnection,
    requestId,
    logFailure: (event) => console.error(JSON.stringify(event)),
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-request-id": requestId,
    },
  });
}
