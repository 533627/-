import { z } from "zod";

import { createLatestManifest } from "@/features/reference-studio-updates/release-contract";
import { getLatestReferenceStudioRelease } from "@/features/reference-studio-updates/release-store";

export const dynamic = "force-dynamic";

const channelSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9._-]+$/);

export async function GET(request: Request) {
  if (!hasUpdateAccess(request)) {
    return jsonError(401, "UNAUTHORIZED", "Update token is invalid.");
  }

  const url = new URL(request.url);
  const parsedChannel = channelSchema.safeParse(
    url.searchParams.get("channel") ?? "stable",
  );
  if (!parsedChannel.success) {
    return jsonError(422, "VALIDATION_ERROR", "Invalid update channel.");
  }

  const release = await getLatestReferenceStudioRelease(parsedChannel.data);
  if (!release) {
    return jsonError(404, "RELEASE_NOT_FOUND", "No published release found.");
  }

  return Response.json(createLatestManifest(release), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function hasUpdateAccess(request: Request) {
  const configuredToken = process.env.REFERENCE_STUDIO_UPDATE_TOKEN?.trim();
  if (!configuredToken) return true;

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${configuredToken}`) return true;

  const token = new URL(request.url).searchParams.get("token");
  return token === configuredToken;
}

function jsonError(status: number, code: string, message: string) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}
