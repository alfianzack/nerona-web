import { CtaLink } from "./CtaLink";

export function PricingTeaser() {
  return (
    <section className="bg-white px-6 py-20 text-center sm:py-28">
      <div className="mx-auto max-w-xl">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          One plan. Every marketplace.
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          A single Nerona Pro subscription covers every supported marketplace, billed monthly
          or yearly.
        </p>
        <div className="mt-8">
          <CtaLink href="/pricing">See pricing</CtaLink>
        </div>
      </div>
    </section>
  );
}
