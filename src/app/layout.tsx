import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof & Practice — Maths Teaching Blog",
  description:
    "Practical strategies, clear explanations, and honest reflections for high school and undergraduate maths.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
