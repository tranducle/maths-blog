import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { verifyAgentApiKey } from "@/lib/agent-auth";

// Guards admin pages + all state-changing API routes. Two independent auth
// surfaces:
//   - /admin/**, /api/posts/**, /api/upload/** → admin COOKIE session (RT-01).
//     Defense-in-depth: each of those routes ALSO calls getSession() itself.
//   - /api/agent/** → bearer API key (AGENT_API_KEY) for external AI agents.
//     Each agent route re-checks via assertAgentAuth() too.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Agent API: separate auth path. No cookie, no CSRF — agents authenticate
  // with a bearer token in the Authorization header.
  if (pathname.startsWith("/api/agent/")) {
    const token = req.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (verifyAgentApiKey(token)) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    // External AI agent API (bearer-key auth, separate from the admin cookie).
    "/api/agent/:path*",
  ],
};
