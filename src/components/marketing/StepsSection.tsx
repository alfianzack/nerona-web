export interface Step {
  title: string;
  body: string;
}

// Fixed number-badge colors for steps 1..3 (blue, orange, dark gold).
const STEP_COLORS = ["#4A7DE8", "#FF8B45", "#9A6B08"];

export function StepsSection({
  title,
  subtitle,
  steps,
  variant = "plain",
  className = "bg-surface",
}: {
  title: string;
  subtitle?: string;
  steps: Step[];
  variant?: "plain" | "cards";
  className?: string;
}) {
  return (
    <section className={`px-6 py-20 ${className}`}>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-2.5 text-center text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className={
                variant === "cards"
                  ? "rounded-2xl bg-surface2 p-5 ring-1 ring-navy-900/[.07]"
                  : "p-5 text-center"
              }
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${
                  variant === "plain" ? "mx-auto" : ""
                }`}
                style={{ backgroundColor: STEP_COLORS[i % STEP_COLORS.length] }}
              >
                {i + 1}
              </span>
              <h3 className="mt-3.5 text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
