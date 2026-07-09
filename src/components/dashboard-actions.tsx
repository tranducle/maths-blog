"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
        return;
      }
      alert("Delete failed.");
    } catch {
      alert("Network error.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button className="delete-btn" onClick={onDelete} disabled={pending}>
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button className="btn-secondary" onClick={onLogout}>
      Sign out
    </button>
  );
}
