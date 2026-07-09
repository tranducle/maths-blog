"use client";

// RT-04: render error boundary so a KaTeX/render throw shows a fallback,
// never a raw 500.
export default function ArticleError({ reset }: { reset: () => void }) {
  return (
    <div className="article-container">
      <h1>Something went wrong rendering this article.</h1>
      <p className="article-deck">
        There may be a problem with the math or diagram markup in this post.
      </p>
      <button className="btn-secondary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
