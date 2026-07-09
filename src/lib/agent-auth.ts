// API-key authentication for external AI agents. Completely separate from the
// cookie-based admin session in auth.ts: agents run outside the browser, have
// no origin/Referer (so CSRF checks don't apply), and authenticate with a
// single static bearer token held in AGENT_API_KEY.
//
// Two layers: middleware calls verifyAgentApiKey (edge) for an early reject,
// and each route handler calls assertAgentAuth (defense-in-depth) again.
//
// Edge-safe: uses the TextEncoder + manual constant-time comparison (no
// node:crypto import), so it runs in both the edge middleware and node routes.

const SCHEME = "Bearer";
const MIN_KEY_LEN = 32; // bytes-equivalent: 32 hex/base64 chars is the floor.

function configuredKey(): string | null {
  const key = process.env.AGENT_API_KEY;
  if (!key || key.length < MIN_KEY_LEN) return null;
  return key;
}

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Constant-time comparison. Returns false if no key is configured or the token
 * is absent/malformed. Never throws on mismatch.
 */
export function verifyAgentApiKey(token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = configuredKey();
  if (!expected) return false;
  return constantTimeEqual(token, expected);
}

/**
 * Extracts the bearer token from the Authorization header and verifies it.
 * Route-handler entry point.
 */
export function assertAgentAuth(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== SCHEME || !token) return false;
  return verifyAgentApiKey(token);
}

/** Whether an API key is configured (for startup / docs diagnostics). */
export function agentAuthConfigured(): boolean {
  return configuredKey() !== null;
}

