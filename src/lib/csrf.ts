import { headers } from "next/headers";

// RT-09: sameSite=lax alone is thin. Enforce a strict same-origin check on all
// state-changing requests. The comparison target is a SERVER-CONFIGURED canonical
// origin (SITE_URL) — NOT the request Host header, which a misconfigurable proxy
// could let the client set (audit M3). Host is only a dev fallback so local
// development works without SITE_URL set.
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");

  // No Origin header (some same-origin GET-style fetches) → fall back to referer.
  const source = origin ?? h.get("referer");
  if (!source) return false;

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
  } catch {
    return false;
  }

  // Prefer the configured canonical origin; fall back to Host for local dev only.
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      return sourceUrl.host === new URL(siteUrl).host;
    } catch {
      return false;
    }
  }

  // Dev fallback (no SITE_URL configured): compare against the request Host.
  const host = h.get("host");
  if (!host) return false;
  return sourceUrl.host === host;
}
