import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// Guards admin pages + all state-changing API routes. RT-01: matcher covers
// /api/posts AND /api/upload. Defense-in-depth: each write route ALSO calls
// getSession() itself — the matcher is not the only line of defense.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = await verifySessionToken(token);

  const isApi = pathname.startsWith("/api/");
  const isLoginPage = pathname === "/admin/login";

  // The login page must stay reachable without a session (else redirect loop).
  if (isLoginPage) {
    if (authed) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  if (!authed) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect the admin area except the login page (handled above once authed).
    "/admin/:path*",
    "/api/posts/:path*",
    "/api/upload/:path*",
  ],
};
