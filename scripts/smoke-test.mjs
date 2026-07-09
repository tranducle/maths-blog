// End-to-end smoke test for the deployed (or local) maths-blog app.
// Exercises the Phase-6 acceptance criteria + Red-Team constraints without a
// browser. Pure Node fetch (no deps).
//
//   node scripts/smoke-test.mjs http://localhost:3000
//   node scripts/smoke-test.mjs https://your-app.vercel.app
//
// Env:
//   SMOKE_ADMIN_USERNAME  admin username (default troisrivers)
//   SMOKE_ADMIN_PASSWORD  admin password (REQUIRED for the authed section)
//   SMOKE_BASE_ORIGIN     override the Origin/Referer host sent on writes
//                         (defaults to the target origin; set to a mismatch to
//                         prove CSRF rejection in the csrf-mismatch case — by
//                         default we use the matching origin so writes succeed)

const BASE = process.argv[2];
if (!BASE || !/^https?:\/\//.test(BASE)) {
  console.error("Usage: node scripts/smoke-test.mjs <http(s)://host[:port]>");
  process.exit(2);
}
const ORIGIN = new URL(BASE).origin;

const ADMIN_USER = process.env.SMOKE_ADMIN_USERNAME ?? "troisrivers";
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASSWORD ?? "";

let pass = 0;
let fail = 0;
const rows = [];
function ok(name, detail = "") {
  pass++;
  rows.push(`  ✓ ${name}${detail ? `  — ${detail}` : ""}`);
}
function bad(name, detail = "") {
  fail++;
  rows.push(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
}

function cookieJar(res) {
  const sc = res.headers.getSetCookie?.() ?? [];
  return sc
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function check(label, { expectStatus, gotStatus, extraOk = true, detail = "" }) {
  if (gotStatus === expectStatus && extraOk) ok(label, detail || `${gotStatus}`);
  else bad(label, detail || `expected ${expectStatus}, got ${gotStatus}`);
}

// ---- 1. Public homepage + seeded content --------------------------------
const home = await fetch(`${BASE}/`, { redirect: "manual" });
await check("homepage returns 200", {
  expectStatus: 200,
  gotStatus: home.status,
});
const homeHtml = await home.text();
if (homeHtml.includes("post-card") || homeHtml.includes("Proof") || homeHtml.includes("posts/")) {
  ok("homepage lists post content");
} else {
  bad("homepage lists post content", "no post markup / links found");
}

// ---- 2. Login: wrong password rejected (RT) -----------------------------
const wrong = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: ORIGIN,
    host: new URL(BASE).host,
  },
  body: JSON.stringify({ username: ADMIN_USER, password: "definitely-wrong-" + Date.now() }),
});
await check("wrong password rejected (401)", {
  expectStatus: 401,
  gotStatus: wrong.status,
});

if (!ADMIN_PASS) {
  rows.push("  ⚠ SMOKE_ADMIN_PASSWORD unset — skipping authed tests (login, draft 404, guards, upload).");
  console.log(report());
  process.exit(fail ? 1 : 0);
}

// ---- 3. Login: correct creds set cookie ---------------------------------
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: ORIGIN,
    host: new URL(BASE).host,
  },
  body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
});
const authCookie = cookieJar(login);
await check("correct login returns 200", {
  expectStatus: 200,
  gotStatus: login.status,
});
await check("login sets session cookie", {
  expectStatus: 200,
  gotStatus: authCookie.includes("session=") ? 200 : 0,
  detail: authCookie.includes("session=") ? "session cookie set" : "no session cookie",
});

if (!authCookie) {
  rows.push("  ⚠ no session cookie — cannot continue authed tests.");
  console.log(report());
  process.exit(1);
}

const authed = {
  cookie: authCookie,
  origin: ORIGIN,
  host: new URL(BASE).host,
};

// ---- 4. Authed vs unauthed admin access ---------------------------------
const adminAuthed = await fetch(`${BASE}/admin`, { redirect: "manual", headers: { cookie: authCookie } });
await check("authed GET /admin reachable (200)", {
  expectStatus: 200,
  gotStatus: adminAuthed.status,
});
const adminAnon = await fetch(`${BASE}/admin`, { redirect: "manual" });
await check("unauthed GET /admin redirects (307/302)", {
  expectStatus: 0,
  gotStatus: [302, 307].includes(adminAnon.status) ? 0 : adminAnon.status,
  detail: `status ${adminAnon.status} → ${adminAnon.headers.get("location")}`,
});

// ---- 5. Unauthed writes blocked (RT-01) ---------------------------------
const postsAnon = await fetch(`${BASE}/api/posts`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: ORIGIN, host: new URL(BASE).host },
  body: JSON.stringify({ title: "x" }),
});
await check("unauthed POST /api/posts blocked (401)", {
  expectStatus: 401,
  gotStatus: postsAnon.status,
});
const uploadAnon = new FormData();
uploadAnon.set("file", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "t.png");
const uploadAnonRes = await fetch(`${BASE}/api/upload`, {
  method: "POST",
  headers: { origin: ORIGIN, host: new URL(BASE).host },
  body: uploadAnon,
});
await check("unauthed POST /api/upload blocked (401)", {
  expectStatus: 401,
  gotStatus: uploadAnonRes.status,
});

// ---- 6. CSRF: mismatched origin rejected (RT-09) ------------------------
const csrfBad = await fetch(`${BASE}/api/posts`, {
  method: "POST",
  headers: {
    cookie: authCookie,
    "content-type": "application/json",
    origin: "https://evil.example.com",
    host: new URL(BASE).host,
  },
  body: JSON.stringify({ title: "csrf-attempt" }),
});
await check("CSRF: mismatched origin rejected (403)", {
  expectStatus: 403,
  gotStatus: csrfBad.status,
});

// ---- 7. Create a DRAFT, verify it is NOT public (RT-02), then delete ----
const draftSlug = "smoke-draft-" + Date.now().toString(36);
const created = await fetch(`${BASE}/api/posts`, {
  method: "POST",
  headers: {
    cookie: authCookie,
    "content-type": "application/json",
    origin: ORIGIN,
    host: new URL(BASE).host,
  },
  body: JSON.stringify({
    title: "Smoke Draft",
    slug: draftSlug,
    bodyMarkdown: "draft body",
    status: "draft",
  }),
});
const createdJson = await created.json().catch(() => null);
await check("create draft (201)", {
  expectStatus: 201,
  gotStatus: created.status,
});
const draftId = createdJson?.post?.id;

const draftPublic = await fetch(`${BASE}/posts/${draftSlug}`, { redirect: "manual" });
await check("draft slug not publicly reachable (404)", {
  expectStatus: 404,
  gotStatus: draftPublic.status,
  detail: `status ${draftPublic.status}`,
});

// ---- 8. SVG upload rejected (RT-08) -------------------------------------
const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`;
const svgForm = new FormData();
svgForm.set("file", new Blob([svg], { type: "image/svg+xml" }), "evil.svg");
const svgRes = await fetch(`${BASE}/api/upload`, {
  method: "POST",
  headers: { cookie: authCookie, origin: ORIGIN, host: new URL(BASE).host },
  body: svgForm,
});
await check("SVG upload rejected (415)", {
  expectStatus: 415,
  gotStatus: svgRes.status,
});

// ---- 9. Publish the draft, verify it becomes public ---------------------
if (draftId) {
  const pub = await fetch(`${BASE}/api/posts/${draftId}`, {
    method: "PUT",
    headers: {
      cookie: authCookie,
      "content-type": "application/json",
      origin: ORIGIN,
      host: new URL(BASE).host,
    },
    body: JSON.stringify({ title: "Smoke Draft", slug: draftSlug, bodyMarkdown: "pub body", status: "published" }),
  });
  await check("publish draft (200)", { expectStatus: 200, gotStatus: pub.status });

  const nowPublic = await fetch(`${BASE}/posts/${draftSlug}`, { redirect: "manual" });
  await check("published slug reachable (200)", {
    expectStatus: 200,
    gotStatus: nowPublic.status,
  });

  // cleanup
  const del = await fetch(`${BASE}/api/posts/${draftId}`, {
    method: "DELETE",
    headers: { cookie: authCookie, origin: ORIGIN, host: new URL(BASE).host },
  });
  await check("cleanup delete (200/204)", {
    expectStatus: [200, 204].includes(del.status) ? del.status : 0,
    gotStatus: del.status,
  });
}

console.log(report());
process.exit(fail ? 1 : 0);

function report() {
  const line = "─".repeat(60);
  return [
    "",
    line,
    `  Smoke test — ${BASE}`,
    line,
    ...rows,
    line,
    `  Result: ${pass} passed, ${fail} failed`,
    "",
  ].join("\n");
}
