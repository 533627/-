type SessionGetter<Session> = (context: {
  headers: Headers;
}) => Promise<Session | null>;

export class AuthenticationRequiredError extends Error {
  readonly code = "AUTHENTICATION_REQUIRED";

  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function requireAuthenticatedSession<Session>(
  getSession: SessionGetter<Session>,
  headers: Headers,
) {
  const session = await getSession({ headers });

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return session;
}
