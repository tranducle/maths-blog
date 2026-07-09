import { visit } from "unist-util-visit";
import type { Root } from "mdast";

// RT-03: map remark-directive nodes to styled elements via hName/hProperties.
// No raw HTML enters the pipeline — custom blocks are plain elements with the
// prototype's CSS classes. Supported:
//   :::pullquote ... :::            → <div class="pullquote">
//   :::figure ... :::figcaption :::  → <figure class="figure"> / <figcaption class="figcaption">
const CLASS_MAP: Record<string, { tag: string; className: string }> = {
  pullquote: { tag: "div", className: "pullquote" },
  figure: { tag: "figure", className: "figure" },
  figcaption: { tag: "figcaption", className: "figcaption" },
};

export function remarkDirectiveBlocks() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (
        node.type === "containerDirective" ||
        node.type === "leafDirective" ||
        node.type === "textDirective"
      ) {
        const mapped = CLASS_MAP[node.name];
        if (!mapped) return;
        const data = node.data || (node.data = {});
        data.hName = mapped.tag;
        data.hProperties = { className: mapped.className };
      }
    });
  };
}
