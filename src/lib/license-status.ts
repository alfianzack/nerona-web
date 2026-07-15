export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function computeLicenseStatus({
  subscriptionStatus,
  pastDueSince,
  now,
}: {
  subscriptionStatus: string;
  pastDueSince: Date | null;
  now: Date;
}): "active" | "expired" {
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    return "active";
  }
  if (subscriptionStatus === "past_due" && pastDueSince) {
    const withinGrace = now.getTime() - pastDueSince.getTime() < PAST_DUE_GRACE_MS;
    return withinGrace ? "active" : "expired";
  }
  return "expired";
}
