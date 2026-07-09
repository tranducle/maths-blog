import Link from "next/link";
import { listAll } from "@/db/queries";
import { formatDate } from "@/lib/format-date";
import { DashboardActions, LogoutButton } from "@/components/dashboard-actions";

// Admin data is request-time and session-scoped; never prerender.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const posts = await listAll();

  return (
    <div className="admin-shell">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Dashboard</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/admin/editor" className="admin-btn">
            + New Post
          </Link>
          <LogoutButton />
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="empty-note">No posts yet. Create your first one.</p>
      ) : (
        <div>
          {posts.map((p) => (
            <div key={p.id} className="post-list-item">
              <div>
                <Link href={`/admin/editor/${p.id}`}>
                  <strong>{p.title}</strong>
                </Link>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  {p.category} · updated {formatDate(p.updatedAt)}
                </div>
              </div>
              <div className="actions">
                <span className={`status-badge ${p.status}`}>{p.status}</span>
                {p.status === "published" ? (
                  <Link className="btn-secondary" href={`/posts/${p.slug}`}>
                    View
                  </Link>
                ) : null}
                <Link className="btn-secondary" href={`/admin/editor/${p.id}`}>
                  Edit
                </Link>
                <DashboardActions id={p.id} title={p.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
