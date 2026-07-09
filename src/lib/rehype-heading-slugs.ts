import { visit } from "unist-util-visit";
import type { Root, Element, Text } from "hast";
import { slugifyHeading, dedupeId } from "@/lib/article-utils";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function hasMathClass(node: Element): boolean {
  const cls = node.properties?.className;
  const list = Array.isArray(cls) ? cls : typeof cls === "string" ? [cls] : [];
  return list.some((c) => String(c).startsWith("math"));
}

// Collect heading text, skipping inline/display math spans — mirrors
// headingPlainText's `$...$` stripping so ids match the TOC (extractToc).
function textOf(node: Element): string {
  let out = "";
  for (const child of node.children) {
    if (child.type === "text") {
      out += (child as Text).value;
    } else if (child.type === "element") {
      if (hasMathClass(child as Element)) continue;
      out += textOf(child as Element);
    }
  }
  return out;
}

// RT/M1: run this BEFORE rehype-katex so heading ids derive from the source
// text (math stripped), identical to the TOC. rehype-slug (which runs after
// KaTeX and slugs the rendered math spans) would otherwise diverge.
export function rehypeHeadingSlugs() {
  return (tree: Root) => {
    const seen = new Map<string, number>();
    visit(tree, "element", (node: Element) => {
      if (!HEADINGS.has(node.tagName)) return;
      if (node.properties?.id) return;
      const id = dedupeId(slugifyHeading(textOf(node).trim()), seen);
      if (id) {
        node.properties = { ...node.properties, id };
      }
    });
  };
}
