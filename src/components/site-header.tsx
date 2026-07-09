import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="site-header">
      <div className="wrapper">
        <div className="logo">
          <Link href="/">
            Proof <span>&amp;</span> Practice
          </Link>
        </div>
        <nav className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/?category=Teaching Strategies">Topics</Link>
          {session ? (
            <>
              <Link href="/admin">Dashboard</Link>
              <Link href="/admin/editor" className="admin-btn">
                + New Post
              </Link>
            </>
          ) : (
            <Link href="/admin/login" className="admin-btn">
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
