import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// RT-07: login rate-limiting. Backed by Upstash Redis / Vercel KV in production.
// If env vars are absent (local dev), rate-limiting is skipped — never blocks dev.

let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 5 attempts per 10 minutes per key, with exponential-ish sliding window.
    limiter: Ratelimit.slidingWindow(5, "600 s"),
    prefix: "login",
    analytics: false,
  });
  return limiter;
}

/** Returns true if the request is allowed, false if rate-limited. */
export async function checkLoginRateLimit(key: string): Promise<boolean> {
  const rl = getLimiter();
  if (!rl) return true; // dev fallback: no Redis configured.
  const { success } = await rl.limit(key);
  return success;
}

let agentLimiter: Ratelimit | null = null;
let agentWarned = false;

function getAgentLimiter(): Ratelimit | null {
  if (agentLimiter) return agentLimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  agentLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // 60 requests per minute per key — generous for a single authoring agent.
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "agent",
    analytics: false,
  });
  return agentLimiter;
}

/**
 * Agent API rate-limit: 60 requests/minute per key. Graceful: if Upstash isn't
 * configured, rate-limiting is skipped (with a one-time console.warn) so the
 * agent still works — wire up Upstash env vars to enable enforcement. (Fail-
 * closed was tried but it permanently blocks the agent when Upstash is
 * intentionally omitted; the key itself is the primary abuse control.)
 */
export async function checkAgentRateLimit(key: string): Promise<boolean> {
  const rl = getAgentLimiter();
  if (!rl) {
    if (!agentWarned) {
      console.warn(
        "[agent] AGENT_API rate-limiting is DISABLED — UPSTASH_REDIS_REST_URL/TOKEN not set.",
      );
      agentWarned = true;
    }
    return true;
  }
  const { success } = await rl.limit(key);
  return success;
}
