import Link from "next/link";

export function CtaBanner({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <section className="px-6 pb-24 pt-16">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 px-8 py-14 text-center">
        <div
          className="pointer-events-none absolute -left-16 -top-32 h-80 w-80 rounded-full bg-brand-blue opacity-50 blur-[90px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-16 h-80 w-80 rounded-full bg-brand-orange opacity-30 blur-[90px]"
          aria-hidden="true"
        />
        <h2 className="relative text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="relative mx-auto mt-3.5 max-w-md text-[15px] leading-relaxed text-navy-100">
          {body}
        </p>
        <Link
          href={ctaHref}
          className="relative mt-7 inline-block rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-6 py-2.5 text-sm font-semibold text-navy-900 shadow-lg shadow-gold-500/30 transition hover:brightness-110"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
