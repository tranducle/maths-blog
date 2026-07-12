"use client";

import { useEffect, useRef, useState } from "react";

// Renders a TikZ snippet to SVG by calling the app's render proxy
// (/api/render-tikz), which forwards to the LaTeX render service server-side.
// This keeps the RENDER_API_KEY off the client and produces LaTeX-quality SVG.
//
// Previously this loaded the TikZJax WASM runtime, but that runtime only scans
// for <script type="text/tikz"> once on window.onload — so dynamically-added
// diagrams (editor preview, re-renders) were never processed. The proxy path
// works on demand and matches the public-page render quality.

export function Tikz({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setSvg(null);
    setError(null);

    // Debounce so rapid edits in the editor don't flood the render service.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/render-tikz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source }),
        });
        const data = (await res.json()) as { svg?: string; error?: string };
        // Ignore if a newer request superseded this one.
        if (id !== reqId.current) return;
        if (!res.ok || !data.svg) {
          setError(data.error || `Render failed (${res.status})`);
          return;
        }
        setSvg(data.svg);
      } catch (err) {
        if (id !== reqId.current) return;
        setError((err as Error).message);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [source]);

  if (error) {
    return (
      <div className="tikz-fallback" role="img" aria-label="TikZ diagram failed">
        <strong>TikZ render error:</strong> {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="tikz-fallback" role="img" aria-label="TikZ diagram loading">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="tikz-figure"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
