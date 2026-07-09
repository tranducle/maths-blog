import { NextResponse } from "next/server";
import { verifyCredentials, createSession } from "@/lib/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";

// bcrypt requires the Node runtime (not edge).
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  // RT-07: rate-limit keyed by IP + username.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowed = await checkLoginRateLimit(`${ip}:${username}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const ok = await verifyCredentials(username, password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createSession(username);
  return NextResponse.json({ ok: true });
}
