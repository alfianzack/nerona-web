export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqSection({
  items,
  title = "Pertanyaan umum",
  className = "bg-surface",
  id,
}: {
  items: FaqItem[];
  title?: string;
  className?: string;
  /** Anchor target, so the top nav can link to this section. */
  id?: string;
}) {
  return (
    <section id={id} className={`px-6 py-20 ${className}`}>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-balance text-center text-3xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <div className="mx-auto mt-8 grid max-w-2xl gap-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl bg-surface2 px-5 py-4 ring-1 ring-navy-900/[.08] open:bg-surface open:ring-brand-blue/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  className="flex-none text-xl font-medium text-brand-blue group-open:hidden"
                  aria-hidden="true"
                >
                  +
                </span>
                <span
                  className="hidden flex-none text-xl font-medium text-brand-blue group-open:block"
                  aria-hidden="true"
                >
                  –
                </span>
              </summary>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
