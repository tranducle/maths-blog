import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { remarkDirectiveBlocks } from "@/lib/remark-directive-blocks";
import { rehypeHeadingSlugs } from "@/lib/rehype-heading-slugs";
import { Tikz } from "./tikz";

// RT-04: throwOnError:false so a single bad `$` renders an inline error instead
// of crashing the render (protects both public article and editor preview).
// RT-03: remark-directive blocks → styled elements. No rehype-raw anywhere.
const rehypeKatexOptions = { throwOnError: false, errorColor: "#cc0000" };

// RT-16: in the editor preview, TikZ must not recompile per keystroke. When
// `tikzPlaceholder` is set, ```tikz fences render a static placeholder instead
// of compiling the multi-MB WASM runtime. Public pages leave it off.
function buildComponents(tikzPlaceholder: boolean): Components {
  return {
    // Intercept ```tikz fenced blocks and render them via the client Tikz component.
    code(props) {
      const { className, children } = props;
      const match = /language-tikz/.test(className || "");
      if (match) {
        const source = String(children).replace(/\n$/, "");
        if (tikzPlaceholder) {
          return (
            <div className="tikz-fallback">
              TikZ diagram — click “Render diagrams” to preview.
            </div>
          );
        }
        return <Tikz source={source} />;
      }
      return <code className={className}>{children}</code>;
    },
  };
}

export function MarkdownRenderer({
  markdown,
  tikzPlaceholder = false,
}: {
  markdown: string;
  tikzPlaceholder?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkDirective, remarkDirectiveBlocks]}
      rehypePlugins={[
        // M1: assign heading ids from source text (math stripped) BEFORE KaTeX
        // runs, so TOC anchors (extractToc) and DOM ids agree even on headings
        // containing inline math. Replaces rehype-slug (which ran after KaTeX
        // and slugged the rendered math spans).
        rehypeHeadingSlugs,
        [rehypeKatex, rehypeKatexOptions],
        rehypeHighlight,
      ]}
      components={buildComponents(tikzPlaceholder)}
    >
      {markdown}
    </ReactMarkdown>
  );
}
