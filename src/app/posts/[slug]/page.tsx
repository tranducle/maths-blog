import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublishedBySlug, listPublished } from "@/db/queries";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TableOfContents } from "@/components/table-of-contents";
import { extractToc, readingTime, initials } from "@/lib/article-utils";
import { formatDate } from "@/lib/format-date";
import { renderTikzBlocks, type TikzRenders } from "@/lib/tikz-render";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPublishedBySlug(slug); // RT-02: published-only.
  if (!post) notFound();

  const toc = extractToc(post.bodyMarkdown);
  const minutes = readingTime(post.bodyMarkdown);

  const others = (await listPublished()).filter((p) => p.id !== post.id).slice(0, 3);

  // Render TikZ blocks to SVG server-side so public visitors see diagrams
  // immediately (no client fetch, no dependency on a Blob cache token). Blocks
  // already cached as blob URLs (in tikzRenders) are skipped. Failures are
  // surfaced to the client as a placeholder (never blank).
  let cachedRenders: TikzRenders | null = null;
  try {
    cachedRenders = post.tikzRenders ? JSON.parse(post.tikzRenders) : null;
  } catch {
    cachedRenders = null;
  }
  const { svgs: tikzSvgs, errors: tikzErrors } = await renderTikzBlocks(
    post.bodyMarkdown,
    cachedRenders,
  );

  return (
    <div className="article-container">
      <div className="article-header">
        <div className="article-eyebrow">{post.category}</div>
        <h1>{post.title}</h1>
        {post.deck ? <p className="article-deck">{post.deck}</p> : null}
        <div className="article-byline">
          <span>
            By <strong>{post.author}</strong>
          </span>
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
          <span className="reading-time">{minutes} min read</span>
          {post.tags[0] ? <span className="card-tag">{post.tags[0]}</span> : null}
        </div>
      </div>

      <TableOfContents entries={toc} />

      <div className="article-body">
        <MarkdownRenderer
          markdown={post.bodyMarkdown}
          tikzRenders={post.tikzRenders}
          tikzSvgs={tikzSvgs}
          tikzErrors={tikzErrors}
        />
      </div>

      <div className="author-footer">
        <div className="author-avatar">{initials(post.author)}</div>
        <div className="author-bio">
          <h4>{post.author}</h4>
          <p>Contributor at Proof &amp; Practice.</p>
        </div>
      </div>

      {others.length > 0 ? (
        <>
          <h2 className="section-title">You might also like</h2>
          <div className="related-grid">
            {others.map((p) => (
              <Link
                key={p.id}
                href={`/posts/${p.slug}`}
                className="related-card"
              >
                <div className="related-thumb">∫</div>
                <h4>{p.title}</h4>
                <p>{p.deck.slice(0, 60)}{p.deck.length > 60 ? "…" : ""}</p>
                <div className="date">
                  {formatDate(p.publishedAt ?? p.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
