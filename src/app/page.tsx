import { Suspense } from "react";
import { Hero } from "@/components/hero";
import { PostCard } from "@/components/post-card";
import { HomeControls } from "@/components/home-controls";
import { listPublished, listCategories } from "@/db/queries";

// Public data is request-time (filters via query params); don't prerender at build.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tag?: string; category?: string; q?: string }>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { tag, category, q } = await searchParams;
  const [posts, categories] = await Promise.all([
    listPublished({ tag, category, q }),
    listCategories(),
  ]);

  const latest = posts[0]?.title;

  return (
    <>
      <Hero latest={latest} />
      <main>
        <div className="wrapper">
          <h2 className="section-title">Recent posts</h2>
          <Suspense>
            <HomeControls categories={categories} />
          </Suspense>
          {posts.length === 0 ? (
            <p className="empty-note">
              No posts match your search yet. Try clearing the filters.
            </p>
          ) : (
            <div className="blog-grid">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
