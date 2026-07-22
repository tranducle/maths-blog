import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { remarkDirectiveBlocks } from "@/lib/remark-directive-blocks";
import { rehypeHeadingSlugs } from "@/lib/rehype-heading-slugs";
import { Tikz } from "./tikz";
import type { TikzRenders } from "@/lib/tikz-render";

// RT-04: throwOnError:false so a single bad `$` renders an inline error instead
// of crashing the render (protects both public article and editor preview).
// RT-03: remark-directive blocks → styled elements. No rehype-raw anywhere.
const rehypeKatexOptions = { throwOnError: false, errorColor: "#cc0000" };

// RT-16: in the editor preview, TikZ must not recompile per keystroke. When
// `tikzPlaceholder` is set, ```tikz fences render a static placeholder instead
// of compiling the multi-MB WASM runtime. Public pages leave it off.
function buildComponents(
  tikzPlaceholder: boolean,
  tikzRenders?: TikzRenders | null,
  tikzSvgs?: TikzRenders | null,
): Components {
  return {
    // Fix: ReactMarkdown wraps a fenced code block's <code> in a <pre>. The
    // global `.article-body pre { background: black }` style then paints a
    // black box behind the diagram. Unwrap <pre> when it only contains a tikz
    // figure/img — render the child directly with no <pre> wrapper.
    pre(props) {
      const child = Array.isArray(props.children)
        ? props.children[0]
        : props.children;
      // react-markdown passes the <code> element as the single child; if our
      // code() override below turned it into a tikz figure/img, the child is a
      // React element whose type is a string tag ("div"/"img"). Detect that and
      // unwrap. Plain code blocks still get the <pre>.
      if (
        child &&
        typeof child === "object" &&
        "props" in child &&
        typeof child.props?.className === "string" &&
        /language-tikz/.test(child.props.className)
      ) {
        return <>{props.children}</>;
      }
      return <pre {...props} />;
    },
    // Intercept ```tikz fenced blocks. Render priority:
    //   1. cached blob URL (tikzRenders) — fastest, set at save time
    //   2. inline SVG (tikzSvgs) — server-rendered on page load (no blob token)
    //   3. <Tikz> client component — fetches /api/render-tikz (editor only)
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
        const key = hashKey(source);
        // 1. Cached blob URL (preferred when Blob token is wired).
        const cachedUrl = tikzRenders?.[key];
        if (cachedUrl) {
          return (
            <div className="tikz-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cachedUrl} alt="TikZ diagram" />
            </div>
          );
        }
        // 2. Inline server-rendered SVG (works without a Blob token).
        const inlineSvg = tikzSvgs?.[key];
        if (inlineSvg) {
          return (
            <div
              className="tikz-figure"
              dangerouslySetInnerHTML={{ __html: inlineSvg }}
            />
          );
        }
        // 3. Client-side fallback (fetches the render proxy — editor preview).
        return <Tikz source={source} />;
      }
      return <code className={className}>{children}</code>;
    },
  };
}

// Same hash as tikz-render.ts (djb2 of the source). Kept inline to avoid
// importing server-only crypto here — this is a client component.
function hashKey(source: string): string {
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = (h * 33) ^ source.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function MarkdownRenderer({
  markdown,
  tikzPlaceholder = false,
  tikzRenders = null,
  tikzSvgs = null,
}: {
  markdown: string;
  tikzPlaceholder?: boolean;
  // Accept either the raw DB JSON string (parsed internally) or a pre-parsed map.
  tikzRenders?: string | TikzRenders | null;
  // Inline server-rendered SVGs: {hash → "<svg ...>"}. Used on public pages
  // when no blob-cached URL exists yet. Computed server-side in the page.
  tikzSvgs?: TikzRenders | null;
}) {
  let parsedRenders: TikzRenders | null = null;
  if (tikzRenders) {
    try {
      parsedRenders =
        typeof tikzRenders === "string"
          ? (JSON.parse(tikzRenders) as TikzRenders)
          : tikzRenders;
    } catch {
      parsedRenders = null;
    }
  }

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
      components={buildComponents(tikzPlaceholder, parsedRenders, tikzSvgs)}
    >
      {markdown}
    </ReactMarkdown>
  );
}

