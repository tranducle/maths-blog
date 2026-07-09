import { headers } from "next/headers";

// RT-09: sameSite=lax alone is thin. Enforce a strict same-origin check on all
// state-changing requests (origin must match host). Cheap and orthogonal.
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (!host) return false;

  // No Origin header (some same-origin GET-style fetches) → fall back to referer.
  const source = origin ?? h.get("referer");
  if (!source) return false;

  try {
    const url = new URL(source);
    return url.host === host;
  } catch {
    return false;
  }
}
