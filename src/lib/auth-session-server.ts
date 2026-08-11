import { auth } from "@/lib/auth";
import { requireAuthenticatedSession } from "@/lib/auth-session";

export function getRequiredSession(headers: Headers) {
  return requireAuthenticatedSession(
    (context) => auth.api.getSession(context),
    headers,
  );
}
