// TOC + reading-time helpers colocated here (RT-15: no separate micro lib files).

export type TocEntry = { id: string; text: string; depth: number };

// Shared heading-id slugger. Both the TOC (extractToc) and the render-side
// heading-id plugin call THIS, so their ids agree by construction — including
// on headings containing inline math, which both strip before slugging.
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Stable de-dup matching github-slugger: first→base, then base-1, base-2… */
export function dedupeId(id: string, seen: Map<string, number>): string {
  const count = seen.get(id) ?? 0;
  seen.set(id, count + 1);
  return count > 0 ? `${id}-${count}` : id;
}

/** Strip inline math + markdown emphasis marks from heading source text. */
export function headingPlainText(raw: string): string {
  return raw
    .replace(/\$[^$]*\$/g, "")
    .replace(/[*_`]/g, "")
    .trim();
}

/** Extract ## / ### headings from Markdown for the table of contents. */
export function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  const lines = markdown.split("\n");
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!m) continue;

    const depth = m[1].length;
    const text = headingPlainText(m[2]);
    if (!text) continue;

    const id = dedupeId(slugifyHeading(text), seen);
    entries.push({ id, text, depth });
  }
  return entries;
}

/** Rough reading time in minutes (~200 wpm), min 1. */
export function readingTime(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function hasTikz(markdown: string): boolean {
  return /```tikz/.test(markdown);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
