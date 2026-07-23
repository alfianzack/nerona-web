interface FeatureSectionProps {
  title: string;
  body: string;
  mockup: React.ReactNode;
  theme: "light" | "dark" | "navy";
  imageSide: "left" | "right";
  bullets?: string[];
}

// "dark" sits on the page canvas and "light" is a slightly lifted surface, so
// sections alternate subtly down the page. "navy" is a true dark band with
// inverted text for sections that should stand out.
export function FeatureSection({
  title,
  body,
  mockup,
  theme,
  imageSide,
  bullets,
}: FeatureSectionProps) {
  const navy = theme === "navy";
  const sectionClass = navy ? "bg-navy-900" : theme === "dark" ? "bg-canvas" : "bg-surface2";

  return (
    <section className={`${sectionClass} px-6 py-24 sm:py-32`}>
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-14 md:flex-row md:gap-20 ${
          imageSide === "left" ? "md:flex-row-reverse" : ""
        }`}
      >
        <div className="flex-1">
          <h2
            className={`text-3xl font-semibold tracking-tight sm:text-5xl ${
              navy ? "text-white" : "text-ink"
            }`}
          >
            {title}
          </h2>
          <p
            className={`mt-5 text-lg leading-relaxed ${navy ? "text-navy-100" : "text-muted"}`}
          >
            {body}
          </p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className={`flex items-start gap-2.5 text-[15px] ${
                    navy ? "text-navy-100" : "text-ink"
                  }`}
                >
                  <span
                    className={`mt-1 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold ${
                      navy
                        ? "bg-brand-sky/20 text-brand-sky"
                        : "bg-emerald-400/15 text-emerald-600"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="w-full flex-1">{mockup}</div>
      </div>
    </section>
  );
}
