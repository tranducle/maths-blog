"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function HomeControls({ categories }: { categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const activeCategory = params.get("category") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");

  // Debounced push of the search term into the URL query.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (q) next.set("q", q);
      else next.delete("q");
      router.replace(`/?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function selectCategory(cat: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (cat) next.set("category", cat);
    else next.delete("category");
    router.replace(`/?${next.toString()}`);
  }

  return (
    <div className="home-controls">
      <input
        className="search-box"
        type="search"
        placeholder="Search posts…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search posts"
      />
      <div className="filter-pills">
        <button
          className={`filter-pill${activeCategory === "" ? " active" : ""}`}
          onClick={() => selectCategory("")}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`filter-pill${activeCategory === cat ? " active" : ""}`}
            onClick={() => selectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
