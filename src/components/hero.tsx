export function Hero({ latest }: { latest?: string }) {
  return (
    <section className="hero">
      <div className="wrapper">
        <h1>
          Teaching maths that <em>sticks</em>.
        </h1>
        <p>
          Practical strategies, clear explanations, and honest reflections for
          high school and undergraduate maths — written by teachers, for
          teachers and students.
        </p>
        {latest ? (
          <span className="hero-tagline">Latest: {latest}</span>
        ) : null}
      </div>
    </section>
  );
}
