import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

import { createBillingPortalSession } from "@/lib/billing-portal";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

describe("createBillingPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the user has no Subscription row", async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue(null);

    const result = await createBillingPortalSession("user-1");

    expect(result).toBeNull();
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a portal session for the user's most recent Stripe customer", async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue({ stripeCustomerId: "cus_1" });
    (stripe.billingPortal.sessions.create as any).mockResolvedValue({
      url: "https://billing.stripe.com/session-1",
    });

    const result = await createBillingPortalSession("user-1");

    expect(result).toEqual({ url: "https://billing.stripe.com/session-1" });
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1" })
    );
  });
});
