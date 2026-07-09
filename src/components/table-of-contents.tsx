import type { TocEntry } from "@/lib/article-utils";

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  if (entries.length < 2) return null;
  return (
    <nav className="toc" aria-label="Table of contents">
      <h4>Contents</h4>
      <ul>
        {entries.map((e) => (
          <li key={e.id} style={{ marginLeft: e.depth === 3 ? 16 : 0 }}>
            <a href={`#${e.id}`}>{e.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
