import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { createCheckoutSession } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no Plan row exists", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue(null);

    const result = await createCheckoutSession("user@example.com", "monthly");

    expect(result).toBeNull();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a subscription-mode session with the monthly price and the user's locked email", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-1",
      stripePriceIdMonthly: "price_monthly",
      stripePriceIdYearly: "price_yearly",
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({ url: "https://checkout.stripe.com/session-1" });

    const result = await createCheckoutSession("user@example.com", "monthly");

    expect(result).toEqual({ url: "https://checkout.stripe.com/session-1" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "user@example.com",
        line_items: [{ price: "price_monthly", quantity: 1 }],
      })
    );
  });

  it("uses the yearly price when interval is yearly", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-1",
      stripePriceIdMonthly: "price_monthly",
      stripePriceIdYearly: "price_yearly",
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({ url: "https://checkout.stripe.com/session-2" });

    await createCheckoutSession("user@example.com", "yearly");

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_yearly", quantity: 1 }] })
    );
  });

  it("returns null when Stripe doesn't return a session URL", async () => {
    (prisma.plan.findFirst as any).mockResolvedValue({
      id: "plan-1",
      stripePriceIdMonthly: "price_monthly",
      stripePriceIdYearly: "price_yearly",
    });
    (stripe.checkout.sessions.create as any).mockResolvedValue({ url: null });

    const result = await createCheckoutSession("user@example.com", "monthly");

    expect(result).toBeNull();
  });
});
