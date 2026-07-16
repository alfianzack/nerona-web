import { CtaLink } from "./CtaLink";

export function Hero() {
  return (
    <section className="bg-gray-900 px-6 py-24 text-center text-white sm:py-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Metadata for stock contributors, written for you.
        </h1>
        <p className="mt-6 text-lg text-gray-300 sm:text-xl">
          Nerona generates titles, descriptions, and keywords with AI, then fills them straight
          into your upload forms.
        </p>
        <div className="mt-10">
          <CtaLink href="/pricing" tone="onDark">
            Get Nerona
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
