import Link from "next/link";
import type { Post } from "@/db/schema";
import { formatDate } from "@/lib/format-date";

export function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/posts/${post.slug}`} className="blog-card">
      <div className="card-category">{post.category}</div>
      <div className="card-title">{post.title}</div>
      <div className="card-excerpt">{post.deck}</div>
      <div className="card-meta">
        <span>{post.author}</span>
        <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        {post.tags[0] ? <span className="card-tag">{post.tags[0]}</span> : null}
      </div>
    </Link>
  );
}
