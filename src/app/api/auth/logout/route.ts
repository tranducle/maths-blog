import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

export async function POST() {
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
