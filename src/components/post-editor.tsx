"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ImageUpload } from "@/components/image-upload";
import { slugify } from "@/lib/slug";
import type { Post } from "@/db/schema";

type Draft = {
  title: string;
  slug: string;
  deck: string;
  category: string;
  tags: string;
  author: string;
  bodyMarkdown: string;
  status: "draft" | "published";
};

function toDraft(post?: Post): Draft {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    deck: post?.deck ?? "",
    category: post?.category ?? "General",
    tags: post?.tags.join(", ") ?? "",
    author: post?.author ?? "",
    bodyMarkdown: post?.bodyMarkdown ?? "",
    status: post?.status ?? "draft",
  };
}

export function PostEditor({ initial }: { initial?: Post }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  // Slug follows the title until the user edits the slug field by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // RT-16: TikZ compiles only when this is true; any body edit resets it.
  const [showDiagrams, setShowDiagrams] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const effectiveSlug = slugTouched ? draft.slug : slugify(draft.title);

  useEffect(() => {
    setShowDiagrams(false);
  }, [draft.bodyMarkdown]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function insertAtCursor(snippet: string) {
    const el = bodyRef.current;
    const body = draft.bodyMarkdown;
    if (!el) {
      set("bodyMarkdown", body + snippet);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + snippet + body.slice(end);
    set("bodyMarkdown", next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function save(status: "draft" | "published") {
    setError("");
    setPending(true);
    const payload = {
      title: draft.title,
      slug: effectiveSlug,
      deck: draft.deck,
      category: draft.category,
      tags: draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      author: draft.author,
      bodyMarkdown: draft.bodyMarkdown,
      status,
    };
    const url = initial ? `/api/posts/${initial.id}` : "/api/posts";
    const method = initial ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Save failed");
    } catch {
      setError("Network error while saving");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-shell">
      <h1>{initial ? "Edit post" : "New post"}</h1>

      <label htmlFor="title">Title</label>
      <input
        id="title"
        type="text"
        value={draft.title}
        onChange={(e) => set("title", e.target.value)}
      />

      <div className="form-row">
        <div>
          <label htmlFor="slug">Slug</label>
          <input
            id="slug"
            type="text"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input
            id="category"
            type="text"
            value={draft.category}
            onChange={(e) => set("category", e.target.value)}
          />
        </div>
      </div>

      <label htmlFor="deck">Deck (summary)</label>
      <input
        id="deck"
        type="text"
        value={draft.deck}
        onChange={(e) => set("deck", e.target.value)}
      />

      <div className="form-row">
        <div>
          <label htmlFor="tags">Tags (comma-separated)</label>
          <input
            id="tags"
            type="text"
            value={draft.tags}
            onChange={(e) => set("tags", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="author">Author</label>
          <input
            id="author"
            type="text"
            value={draft.author}
            onChange={(e) => set("author", e.target.value)}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "16px 0 4px",
        }}
      >
        <label style={{ margin: 0 }}>Body (Markdown + $LaTeX$)</label>
        <ImageUpload onUploaded={(url) => insertAtCursor(`\n![](${url})\n`)} />
      </div>

      <div className="editor-grid">
        <div className="editor-pane">
          <textarea
            ref={bodyRef}
            value={draft.bodyMarkdown}
            onChange={(e) => set("bodyMarkdown", e.target.value)}
            style={{ minHeight: "60vh" }}
          />
        </div>
        <div className="preview-pane">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h4>Live preview</h4>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowDiagrams(true)}
              disabled={showDiagrams}
            >
              {showDiagrams ? "Diagrams rendered" : "Render diagrams"}
            </button>
          </div>
          <div className="article-body">
            <MarkdownRenderer
              markdown={draft.bodyMarkdown}
              tikzPlaceholder={!showDiagrams}
            />
          </div>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button
          className="submit-btn"
          type="button"
          onClick={() => save("published")}
          disabled={pending}
        >
          {pending ? "Saving…" : "Publish"}
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => save("draft")}
          disabled={pending}
        >
          Save draft
        </button>
      </div>
    </div>
  );
}
