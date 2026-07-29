/**
 * Every marketplace with an adapter — the functional registry.
 *
 * Keys MUST match the extension's own ALL_MARKETPLACES (nerona_medata
 * access/access.js) and marketplace-resolve.js. A plan storing a key the
 * extension does not recognise silently denies access to a marketplace the plan
 * grants, with nothing logged on either side. tests/lib/marketplaces.test.ts
 * asserts the two lists agree.
 *
 * `claimable` is a marketing gate, not a functional one: a non-claimable
 * marketplace still works and can still be granted, it just may not be named in
 * copy.
 */
export const MARKETPLACES = [
  { key: "adobe", label: "Adobe Stock", claimable: true },
  { key: "shutterstock", label: "Shutterstock", claimable: true },
  { key: "vecteezy", label: "Vecteezy", claimable: true },
  { key: "canva", label: "Canva", claimable: true },
  // Excluded from copy while QA_CHECKLIST.md flags the adapter as likely broken
  // (it is a 6-line stub aliasing the generic handler). Re-including it is this
  // one word, once its QA passes.
  { key: "designbundle", label: "Design Bundles", claimable: false },
  { key: "dreamstime", label: "Dreamstime", claimable: true },
  { key: "magnific", label: "Magnific", claimable: true },
  { key: "miricanvas", label: "Miricanvas", claimable: true },
] as const;

/**
 * The only marketplaces marketing may name. Deliberately under-claims: a "*"
 * plan functionally reaches all eight while every page says seven, and
 * under-claiming is the correct direction to be wrong in.
 */
export const CLAIMABLE_MARKETPLACES = MARKETPLACES.filter((m) => m.claimable);

// `marketplaces` is "*" (every marketplace) or a comma-separated list of keys
// from MARKETPLACES above, as stored on Plan/License.
export function describeMarketplaces(marketplaces: string): string {
  // "*" is a claim ("everything we offer"), so it counts only what we claim.
  if (marketplaces === "*") {
    return `Semua ${CLAIMABLE_MARKETPLACES.length} marketplace`;
  }
  // An explicit list is a statement of fact about one plan, so it resolves
  // against the full registry: filtering it through CLAIMABLE_MARKETPLACES
  // would render a blank feature row for a plan granted only non-claimable
  // marketplaces, which is worse than naming one we do not advertise.
  const keys = new Set(marketplaces.split(",").map((key) => key.trim()));
  return MARKETPLACES.filter((m) => keys.has(m.key))
    .map((m) => m.label)
    .join(", ");
}
