# Agent API — Programmatic Post Management

A REST API for external AI agents (and scripts) to create, update, delete, and
list blog posts — without a browser session. Authenticated with a single bearer
API key, completely separate from the cookie-based admin login.

> **Base URL:** `https://maths-blog.vercel.app`
> **Auth header:** `Authorization: Bearer <AGENT_API_KEY>`

---

## Authentication

Every request must include:

```
Authorization: Bearer <your-agent-api-key>
```

- The key is a static token stored in the `AGENT_API_KEY` environment variable.
- Requests without it, or with a wrong key, get **401 Unauthorized**.
- The key is compared in constant time (timing-attack resistant).
- There is **no CSRF / Origin check** on these routes — agents are expected to
  call cross-origin (or with no Origin at all). That is by design.

### Getting a key

```bash
node scripts/generate-agent-key.mjs
# prints: AGENT_API_KEY=<64 hex chars>
```

Paste that value into Vercel env (`vercel env add AGENT_API_KEY production preview`) and `.env.local`, then redeploy. **Rotate** the key by generating a new one and updating the env var.

### Rate limit

- **60 requests / minute** per client (keyed by IP).
- Enforced via Upstash Redis **when configured**. If Upstash env vars are unset, rate-limiting is skipped (the server logs a one-time warning) — wire up Upstash to enforce.
- Exceeding the limit returns **429 Too Many Requests**.

---

## Endpoints

### 1. List / search posts

```
GET /api/agent/posts
```

**Query params** (all optional):

| Param     | Default       | Description |
|-----------|---------------|-------------|
| `status`  | `published`   | `published` \| `draft` \| `all`. `all`/`draft` return posts of any status (useful for the agent to manage drafts). |
| `q`       | —             | Case-insensitive substring over title, deck, and body. |
| `tag`     | —             | Exact tag match (posts where `tags` contains it). |
| `category`| —             | Exact category match. |
| `limit`   | `50`          | Max 100. |

**Example:**

```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" \
  "https://maths-blog.vercel.app/api/agent/posts?status=all&q=quadratic&limit=5"
```

**Response (200):**

```json
{
  "posts": [
    {
      "id": "uuid",
      "slug": "making-quadratic-functions-intuitive",
      "title": "Making Quadratic Functions Intuitive",
      "deck": "A short summary shown on the card.",
      "category": "Algebra",
      "tags": ["quadratics", "teaching"],
      "author": "Trois Rivieres",
      "status": "published",
      "createdAt": "2026-07-08T...",
      "updatedAt": "2026-07-08T...",
      "publishedAt": "2026-07-08T..."
    }
  ],
  "count": 1
}
```

> The list endpoint omits `bodyMarkdown` to keep payloads small. Use it to
> discover post IDs/slugs, then fetch the full post from the public URL if you
> need the body.

---

### 2. Create a post

```
POST /api/agent/posts
Content-Type: application/json
```

**Body** — all fields optional except `title`:

| Field          | Type       | Required | Default     | Notes |
|----------------|------------|----------|-------------|-------|
| `title`        | string     | **yes**  | —           | |
| `slug`         | string     | no       | derived from `title` | Must be unique; 409 if taken. |
| `deck`         | string     | no       | `""`        | Card subtitle / summary. |
| `category`     | string     | no       | `"General"` | |
| `tags`         | string[]   | no       | `[]`        | e.g. `["algebra","teaching"]`. Non-strings dropped. |
| `author`       | string     | no       | `"Anonymous"` | |
| `bodyMarkdown` | string     | no       | `""`        | Markdown body — see **Markdown features** below. |
| `status`       | string     | no       | `"draft"`   | Any value other than `"published"` is treated as `draft`. |

**Example — create + publish in one call:**

```bash
curl -X POST "https://maths-blog.vercel.app/api/agent/posts" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Why the Derivative is a Slope",
    "deck": "A first look at the geometric meaning of differentiation.",
    "category": "Calculus",
    "tags": ["derivatives", "intuition"],
    "author": "Proof & Practice",
    "bodyMarkdown": "## The big idea\n\nFor $f(x) = x^2$, $f'"'"'(x) = 2x$.\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$",
    "status": "published"
  }'
```

**Response (201):** `{ "post": { ...full post object, including the new id } }`

**Errors:** `400` title missing / slug undeducible · `409` slug already in use.

---

### 3. Update a post

```
PUT /api/agent/posts/{id}
Content-Type: application/json
```

- `{id}` is the post UUID (get it from the list endpoint).
- The body is a **partial** patch — send only the fields you want to change.
- Same field semantics as create. Sending `status: "published"` publishes a draft (stamps `publishedAt` on first publish only).

**Example — publish a draft:**

```bash
curl -X PUT "https://maths-blog.vercel.app/api/agent/posts/$POST_ID" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "published" }'
```

**Response (200):** `{ "post": { ...updated post } }`
**Errors:** `400` bad field · `404` id not found · `409` slug collision.

---

### 4. Delete a post

```
DELETE /api/agent/posts/{id}
```

**Example:**

```bash
curl -X DELETE "https://maths-blog.vercel.app/api/agent/posts/$POST_ID" \
  -H "Authorization: Bearer $AGENT_API_KEY"
```

**Response (200):** `{ "ok": true }`
**Errors:** `404` id not found.

---

## Markdown features (for `bodyMarkdown`)

The renderer supports everything the public site does:

- **Standard Markdown** — headings, lists, links, code blocks, blockquotes.
- **KaTeX math** — inline `$...$` and display `$$...$$`. Use `\\` for backslashes in JSON.
  - Malformed LaTeX renders an inline error, **never** a 500.
- **TikZ diagrams** — a fenced code block with the `tikz` language:
  ````
  ```tikz
  \begin{tikzpicture}
    \draw[thick] (0,0) -- (3,0) -- (0,2) -- cycle;
  \end{tikzpicture}
  ```
  ````
- **Custom blocks** via `remark-directive` (no raw HTML allowed):
  ```
  :::pullquote
  A quadratic is just a number times a square, shifted.
  :::
  ```
- **Syntax highlighting** in fenced code blocks (github-dark theme).

---

## Error reference

| Status | Meaning |
|--------|---------|
| `400` | Malformed JSON, missing `title`, or invalid field. |
| `401` | Missing/wrong `Authorization` header. |
| `404` | Post id not found (PUT/DELETE). |
| `409` | Slug already in use (create/update). |
| `429` | Rate limit exceeded — slow down (60 req/min). |
| `500` | Server error (DB down, etc.). Rare. |

Error body shape: `{ "error": "human-readable message" }`.

---

## Code examples

### Python (requests)

```python
import requests, os

BASE = "https://maths-blog.vercel.app"
HEADERS = {"Authorization": f"Bearer {os.environ['AGENT_API_KEY']}"}

# Create a draft
r = requests.post(f"{BASE}/api/agent/posts", headers=HEADERS, json={
    "title": "Draft via API",
    "bodyMarkdown": "Work in progress: $e^{i\\pi} + 1 = 0$.",
    "tags": ["drafts"],
})
post = r.json()["post"]
print(post["id"], post["slug"])

# Publish it
requests.put(f"{BASE}/api/agent/posts/{post['id']}", headers=HEADERS,
             json={"status": "published"})
```

### Node.js (fetch)

```js
const BASE = "https://maths-blog.vercel.app";
const headers = {
  Authorization: `Bearer ${process.env.AGENT_API_KEY}`,
  "Content-Type": "application/json",
};

// List all posts (incl. drafts)
const list = await fetch(`${BASE}/api/agent/posts?status=all`, { headers })
  .then(r => r.json());

// Create
const { post } = await fetch(`${BASE}/api/agent/posts`, {
  method: "POST", headers,
  body: JSON.stringify({ title: "From Node", status: "draft" }),
}).then(r => r.json());
```

### OpenAI function-calling schema (for LLM agents)

```json
{
  "name": "create_post",
  "description": "Create a blog post (draft or published).",
  "parameters": {
    "type": "object",
    "required": ["title"],
    "properties": {
      "title": { "type": "string" },
      "bodyMarkdown": { "type": "string", "description": "Markdown body; supports $math$ and ```tikz blocks" },
      "status": { "type": "string", "enum": ["draft", "published"] },
      "tags": { "type": "array", "items": { "type": "string" } },
      "category": { "type": "string" },
      "deck": { "type": "string" },
      "slug": { "type": "string" },
      "author": { "type": "string" }
    }
  }
}
```

---

## Security notes

- The key grants **full CRUD** (create / update / delete / list, including drafts). Treat it like a password — store it in a secret manager, never commit it.
- All 4 operations work on **any** post (no per-post permissions). Suitable for a single trusted agent.
- The key is never logged or returned in any response.
- To **revoke**, unset/change `AGENT_API_KEY` in Vercel env and redeploy.
- For multiple agents with independent keys / scopes, extend with a DB-backed `api_keys` table (future work; not implemented).
