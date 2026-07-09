import type { NewPost } from "../src/db/schema";

// Demo posts hand-authored with REAL KaTeX ($...$ / $$) and remark-directive
// custom blocks (:::pullquote, :::figure/:::figcaption). RT-02/RT-03.
// Fixed deterministic slugs → idempotent ON CONFLICT seeding.

const quadratics = `## The problem with $ax^2 + bx + c$

When students first see $f(x) = ax^2 + bx + c$, their eyes glaze over. The standard form is useful for calculations, but it tells you nothing about what a quadratic *is*.

I've found that starting with the graph — not the formula — changes everything. Draw a simple parabola on the board. Ask: "What do you notice?" Students see symmetry, a turning point, the shape getting steeper. That's the intuition we should build on.

:::pullquote
A quadratic is just a number times a square, shifted. That's it. Everything else is details.
:::

## Three teaching moves that work

First, teach **vertex form** before standard form. Show that

$$f(x) = a(x - h)^2 + k$$

directly tells you where the parabola lives and how stretched it is. Students can *see* the shift: the vertex sits at $(h, k)$.

Second, use graphing software. Let students drag sliders for $a$, $h$, and $k$. The pattern sticks because they discovered it themselves.

Third, give them a real problem. "A ball is thrown from a 10m platform. Where does it land?" That's motivation standard form never provides.

> One student told me: "I never understood why there were two answers. Now I see — the parabola crosses the x-axis in two places." That's the moment we're all chasing.

## The research backs it up

The roots come from the quadratic formula $x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$, and the discriminant $b^2 - 4ac$ tells you how many real roots there are. Intuition before computation.

So next time you teach quadratics, start with the graph. Let the formula follow.`;

const fractions = `## The fraction wall

Most students can add whole numbers. The moment fractions appear, the confidence vanishes. Why? Because fractions break the counting intuition students have spent years building.

The fix is surprisingly simple: never start with the notation. Start with the *thing*. A chocolate bar. A pizza. A strip of paper. When students fold a paper strip into thirds and see that three "thirds" make one whole — $3 \\times \\tfrac{1}{3} = 1$ — the fraction symbol becomes a label for something they already understand.

:::figure
:::figcaption
Visualizing fraction division — how many quarters fit in a half? $\\tfrac{1}{2} \\div \\tfrac{1}{4} = 2$.
:::
:::

## Common errors with fractions

- **Adding denominators** — writing $\\tfrac{1}{2} + \\tfrac{1}{4} = \\tfrac{2}{6}$. They're treating fractions as two separate numbers.
- **Losing the whole** — "Which is bigger, $\\tfrac{1}{2}$ or $\\tfrac{1}{4}$?" Without a shared whole, the question stalls.
- **Division is mysterious** — "Why does $\\tfrac{1}{2} \\div \\tfrac{1}{4} = 2$? That doesn't make sense."

The fix for all three: **visual models**. The correct addition, $\\tfrac{1}{2} + \\tfrac{1}{4} = \\tfrac{3}{4}$, becomes obvious once the pieces share a whole. Once students *see* what fractions mean, the procedures follow naturally.`;

const proofs = `## Proof is not magic

Every undergraduate hits the wall: "How do I even start a proof?" The answer is a small set of reusable techniques. Master these three and you can handle 80% of what first-year analysis throws at you.

## 1. Direct proof

State what you know, apply definitions, reach the conclusion. Example: prove that the sum of two even numbers is even.

$$\\text{Let } a = 2m,\\; b = 2n \\text{ for integers } m, n. \\\\ \\text{Then } a + b = 2m + 2n = 2(m + n).$$

Since $m + n$ is an integer, $a + b$ is even. $\\blacksquare$

## 2. Proof by contrapositive

Instead of proving $P \\Rightarrow Q$, prove $\\lnot Q \\Rightarrow \\lnot P$. They're logically equivalent, and one is often easier.

## 3. Induction

Prove a base case. Assume it works for $k$. Show it works for $k+1$. A classic result:

$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}.$$

The dominoes fall.

> "But why does induction work?" Because the natural numbers are well-ordered. It's not a trick — it's a definition.`;

const tikzDemo = `## Drawing with TikZ

Sometimes a diagram says what a paragraph cannot. This post embeds a diagram authored directly in TikZ and rendered in the browser.

## A labelled right triangle

The Pythagorean relationship $a^2 + b^2 = c^2$ is easiest to *see*:

\`\`\`tikz
\\begin{tikzpicture}[scale=1.4]
  \\draw[thick] (0,0) -- (3,0) -- (0,2) -- cycle;
  \\draw (0,0) rectangle (0.3,0.3);
  \\node[below] at (1.5,0) {$a$};
  \\node[left] at (0,1) {$b$};
  \\node[above right] at (1.5,1) {$c$};
\\end{tikzpicture}
\`\`\`

If the diagram fails to compile in your browser, the source above is shown as a fallback — the page never breaks.

## Why bother?

Because a hand-drawn parabola on a whiteboard disappears. A TikZ figure is reproducible, scalable, and lives in the post forever.`;

export const seedPosts: NewPost[] = [
  {
    slug: "making-quadratic-functions-intuitive",
    title: "Making Quadratic Functions Intuitive",
    deck: "Why the standard form hides the story — and how to teach it visually.",
    category: "Algebra",
    tags: ["algebra", "quadratics", "teaching"],
    author: "Sarah Chen",
    bodyMarkdown: quadratics,
    status: "published",
    publishedAt: new Date("2026-04-28T09:00:00Z"),
  },
  {
    slug: "why-students-struggle-with-fractions",
    title: "Why Students Struggle with Fractions (and What Works)",
    deck: "A concrete approach that turns \"I hate fractions\" into genuine understanding.",
    category: "Teaching Strategies",
    tags: ["fractions", "teaching"],
    author: "James Okonkwo",
    bodyMarkdown: fractions,
    status: "published",
    publishedAt: new Date("2026-04-21T09:00:00Z"),
  },
  {
    slug: "three-proof-techniques-every-undergraduate-should-know",
    title: "Three Proof Techniques Every Undergraduate Should Know",
    deck: "Direct proof, contrapositive, and induction — mastered in one afternoon.",
    category: "Number Theory",
    tags: ["proofs", "induction"],
    author: "Dr. Elena Vasquez",
    bodyMarkdown: proofs,
    status: "published",
    publishedAt: new Date("2026-04-14T09:00:00Z"),
  },
  {
    slug: "drawing-diagrams-with-tikz",
    title: "Drawing Diagrams with TikZ",
    deck: "Reproducible, scalable figures authored right inside your posts.",
    category: "Geometry",
    tags: ["tikz", "geometry", "diagrams"],
    author: "Sarah Chen",
    bodyMarkdown: tikzDemo,
    status: "published",
    publishedAt: new Date("2026-05-05T09:00:00Z"),
  },
];
