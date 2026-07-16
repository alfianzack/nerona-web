interface FeatureSectionProps {
  title: string;
  body: string;
  mockup: React.ReactNode;
  theme: "light" | "dark";
  imageSide: "left" | "right";
}

export function FeatureSection({ title, body, mockup, theme, imageSide }: FeatureSectionProps) {
  const isDark = theme === "dark";
  const sectionClass = isDark ? "bg-gray-900 text-white" : "bg-white text-gray-900";
  const bodyClass = isDark ? "text-gray-300" : "text-gray-600";

  return (
    <section className={`${sectionClass} px-6 py-20 sm:py-28`}>
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-12 md:flex-row ${
          imageSide === "left" ? "md:flex-row-reverse" : ""
        }`}
      >
        <div className="flex-1">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          <p className={`mt-4 text-lg ${bodyClass}`}>{body}</p>
        </div>
        <div className="flex-1">{mockup}</div>
      </div>
    </section>
  );
}
