interface FeatureSectionProps {
  title: string;
  body: string;
  mockup: React.ReactNode;
  theme: "light" | "dark";
  imageSide: "left" | "right";
}

// Both themes are navy; "light" is a slightly lifted surface so sections
// alternate subtly down the page.
export function FeatureSection({ title, body, mockup, theme, imageSide }: FeatureSectionProps) {
  const sectionClass = theme === "dark" ? "bg-navy-950" : "bg-navy-900/40";

  return (
    <section className={`${sectionClass} px-6 py-24 sm:py-32`}>
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-14 md:flex-row md:gap-20 ${
          imageSide === "left" ? "md:flex-row-reverse" : ""
        }`}
      >
        <div className="flex-1">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h2>
          <p className="mt-5 text-lg leading-relaxed text-navy-300">{body}</p>
        </div>
        <div className="w-full flex-1">{mockup}</div>
      </div>
    </section>
  );
}
