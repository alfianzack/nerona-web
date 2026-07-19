export const MARKETPLACES = [
  { key: "adobe", label: "Adobe Stock" },
  { key: "shutterstock", label: "Shutterstock" },
  { key: "vecteezy", label: "Vecteezy" },
  { key: "canva", label: "Canva" },
  { key: "designbundles", label: "Design Bundles" },
  { key: "dreamstime", label: "Dreamstime" },
  { key: "magnific", label: "Magnific" },
  { key: "miricanvas", label: "Miricanvas" },
] as const;

// `marketplaces` is "*" (every marketplace) or a comma-separated list of keys
// from MARKETPLACES above, as stored on Plan/License.
export function describeMarketplaces(marketplaces: string): string {
  if (marketplaces === "*") {
    return `Semua ${MARKETPLACES.length} marketplace`;
  }
  const keys = new Set(marketplaces.split(",").map((key) => key.trim()));
  return MARKETPLACES.filter((m) => keys.has(m.key))
    .map((m) => m.label)
    .join(", ");
}
