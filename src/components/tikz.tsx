"use client";

import { useEffect, useRef, useState } from "react";

// RT-05: React never executes a markup-injected <script>. TikZJax works by
// scanning for <script type="text/tikz"> elements, so we inject a REAL script
// node imperatively, load the TikZJax runtime once, and tear down on change.
// Assets are self-hosted under public/tikzjax (version-pinned). On any failure
// we render the source as a fallback so the page never breaks.

let tikzRuntimeLoaded = false;
let tikzRuntimeLoading: Promise<void> | null = null;

function loadTikzRuntime(): Promise<void> {
  if (tikzRuntimeLoaded) return Promise.resolve();
  if (tikzRuntimeLoading) return tikzRuntimeLoading;

  tikzRuntimeLoading = new Promise<void>((resolve, reject) => {
    // TikZJax CSS (fonts) — harmless if it 404s in dev before assets are added.
    if (!document.querySelector('link[data-tikzjax]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/tikzjax/fonts.css";
      link.setAttribute("data-tikzjax", "true");
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "/tikzjax/tikzjax.js";
    script.async = true;
    script.onload = () => {
      tikzRuntimeLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("TikZJax runtime failed to load"));
    document.body.appendChild(script);
  });
  return tikzRuntimeLoading;
}

export function Tikz({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // Clear any previously rendered SVG (prevents duplication on re-render).
    container.innerHTML = "";

    const scriptEl = document.createElement("script");
    scriptEl.type = "text/tikz";
    scriptEl.textContent = source;
    container.appendChild(scriptEl);

    loadTikzRuntime()
      .then(() => {
        if (cancelled) return;
        // If the global processor exposes a manual trigger, call it.
        const proc = (window as unknown as { tikzjax?: { process?: () => void } })
          .tikzjax;
        proc?.process?.();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [source]);

  if (failed) {
    return (
      <div className="tikz-fallback" role="img" aria-label="TikZ diagram source">
        {source}
      </div>
    );
  }

  return <div className="tikz-figure" ref={containerRef} />;
}
