import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    license: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    order: { create: vi.fn() },
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn() },
  },
}));
vi.mock("@/lib/license", () => ({ generateLicenseKey: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendLicenseEmail: vi.fn() }));

import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/stripe-webhooks";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { generateLicenseKey } from "@/lib/license";
import { sendLicenseEmail } from "@/lib/mail";

function fakeSession(overrides = {}) {
  return {
    id: "cs_1",
    subscription: "sub_1",
    customer: "cus_1",
    customer_email: "user@example.com",
    customer_details: { email: "user@example.com" },
    ...overrides,
  } as any;
}

function fakeStripeSubscription(overrides = {}) {
  return {
    id: "sub_1",
    status: "active",
    current_period_end: 1_800_000_000,
    items: { data: [{ price: { id: "price_monthly" } }] },
    ...overrides,
  } as any;
}

describe("handleCheckoutSessionCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when the Subscription already exists (redelivered event)", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: "existing-sub" });

    await handleCheckoutSessionCompleted(fakeSession());

    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(sendLicenseEmail).not.toHaveBeenCalled();
  });

  it("logs and returns when no User exists for the session's email", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleCheckoutSessionCompleted(fakeSession());

    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("creates a Subscription and a new License, then emails the key, on first completion", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "user@example.com" });
    (stripe.subscriptions.retrieve as any).mockResolvedValue(fakeStripeSubscription());
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-1" });
    (prisma.subscription.create as any).mockResolvedValue({ id: "subscription-row-1" });
    (prisma.license.findFirst as any).mockResolvedValue(null);
    (generateLicenseKey as any).mockResolvedValue("NERONA-AB12-CD34-EF56");
    (prisma.license.create as any).mockResolvedValue({ licenseKey: "NERONA-AB12-CD34-EF56" });

    await handleCheckoutSessionCompleted(fakeSession());

    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        planId: "plan-1",
        stripeSubscriptionId: "sub_1",
        stripeCustomerId: "cus_1",
        status: "active",
      }),
    });
    expect(prisma.license.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        licenseKey: "NERONA-AB12-CD34-EF56",
        status: "active",
        source: "stripe",
        planId: "plan-1",
      }),
    });
    expect(sendLicenseEmail).toHaveBeenCalledWith("user@example.com", "NERONA-AB12-CD34-EF56");
  });

  it("reuses an existing License row instead of creating a duplicate", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-1", email: "user@example.com" });
    (stripe.subscriptions.retrieve as any).mockResolvedValue(fakeStripeSubscription());
    (prisma.plan.findFirst as any).mockResolvedValue({ id: "plan-1" });
    (prisma.subscription.create as any).mockResolvedValue({ id: "subscription-row-1" });
    (prisma.license.findFirst as any).mockResolvedValue({
      id: "license-1",
      licenseKey: "NERONA-EXIST-ING1-KEY0",
    });
    (prisma.license.update as any).mockResolvedValue({ licenseKey: "NERONA-EXIST-ING1-KEY0" });

    await handleCheckoutSessionCompleted(fakeSession());

    expect(generateLicenseKey).not.toHaveBeenCalled();
    expect(prisma.license.create).not.toHaveBeenCalled();
    expect(prisma.license.update).toHaveBeenCalledWith({
      where: { id: "license-1" },
      data: expect.objectContaining({ status: "active", planId: "plan-1" }),
    });
    expect(sendLicenseEmail).toHaveBeenCalledWith("user@example.com", "NERONA-EXIST-ING1-KEY0");
  });
});

describe("handleSubscriptionUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs and returns when no Subscription row is found", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleSubscriptionUpdated({
      id: "sub_missing",
      status: "active",
      current_period_end: 1_800_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as any);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("sets the license active and clears pastDueSince when status returns to active", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "subscription-row-1",
      userId: "user-1",
      pastDueSince: new Date("2026-01-01"),
    });

    await handleSubscriptionUpdated({
      id: "sub_1",
      status: "active",
      current_period_end: 1_800_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-row-1" },
      data: expect.objectContaining({ status: "active", pastDueSince: null }),
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ status: "active" }),
    });
  });

  it("sets pastDueSince on first past_due delivery and keeps the license active (within grace)", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "subscription-row-1",
      userId: "user-1",
      pastDueSince: null,
    });

    await handleSubscriptionUpdated({
      id: "sub_1",
      status: "past_due",
      current_period_end: 1_800_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-row-1" },
      data: expect.objectContaining({ status: "past_due", pastDueSince: expect.any(Date) }),
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ status: "active" }),
    });
  });

  it("expires the license once past_due has exceeded the grace period", async () => {
    const longAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    (prisma.subscription.findUnique as any).mockResolvedValue({
      id: "subscription-row-1",
      userId: "user-1",
      pastDueSince: longAgo,
    });

    await handleSubscriptionUpdated({
      id: "sub_1",
      status: "past_due",
      current_period_end: 1_800_000_000,
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as any);

    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: expect.objectContaining({ status: "expired" }),
    });
  });
});

describe("handleSubscriptionDeleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs and returns when no Subscription row is found", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleSubscriptionDeleted({ id: "sub_missing" } as any);

    expect(prisma.subscription.update).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("marks the Subscription canceled and the License expired", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: "subscription-row-1", userId: "user-1" });

    await handleSubscriptionDeleted({ id: "sub_1" } as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "subscription-row-1" },
      data: { status: "canceled" },
    });
    expect(prisma.license.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { status: "expired" },
    });
  });
});

describe("handleInvoicePaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the invoice has no subscription", async () => {
    await handleInvoicePaid({ id: "in_1", parent: null } as any);

    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("logs and returns when no Subscription row is found", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handleInvoicePaid({
      id: "in_1",
      parent: { subscription_details: { subscription: "sub_missing" } },
    } as any);

    expect(prisma.order.create).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("creates an Order row for the invoice", async () => {
    (prisma.subscription.findUnique as any).mockResolvedValue({ id: "subscription-row-1", userId: "user-1" });

    await handleInvoicePaid({
      id: "in_1",
      parent: { subscription_details: { subscription: "sub_1" } },
      amount_paid: 1200,
      currency: "usd",
      status: "paid",
    } as any);

    expect(prisma.order.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        stripeInvoiceId: "in_1",
        amount: 1200,
        currency: "usd",
        status: "paid",
        refunded: false,
      },
    });
  });
});
