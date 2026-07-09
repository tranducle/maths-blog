import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TikZJax assets are self-hosted under public/; ensure .wasm is served correctly.
  async headers() {
    return [
      {
        source: "/tikzjax/:file*.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
    ];
  },
};

export default nextConfig;
