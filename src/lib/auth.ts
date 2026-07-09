import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// bcryptjs is Node-only; import lazily inside verifyCredentials so this module
// stays importable from the edge middleware (which only verifies the JWT).

const COOKIE_NAME = "session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30-day sliding session (validated choice).

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set and >= 32 characters (>= 32 random bytes).",
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { sub: string };

/** Verify username + password against env config. Node runtime only (bcrypt). */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUser || !hash) return false;
  if (username !== expectedUser) return false;

  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(password, hash);
}

async function signSession(sub: string): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

const cookieOptions = () => ({
  httpOnly: true,
  // RT-11: secure only in production so localhost dev over http keeps the session.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TTL_SECONDS,
});

/** Create session + set httpOnly cookie. */
export async function createSession(username: string): Promise<void> {
  const token = await signSession(username);
  const store = await cookies();
  store.set(COOKIE_NAME, token, cookieOptions());
}

/** Read + verify the session from the request cookie. Returns null if absent/invalid. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret());
    return payload.sub ? { sub: payload.sub } : null;
  } catch {
    return null;
  }
}

/** Clear the session cookie. Stateless JWT stays valid until exp (documented). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Edge-safe verification for middleware — token string in, boolean out. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
