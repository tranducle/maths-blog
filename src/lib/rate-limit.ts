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
