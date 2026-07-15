import type Stripe from "stripe";
import { prisma } from "./prisma";
import { stripe } from "./stripe";
import { generateLicenseKey } from "./license";
import { sendLicenseEmail } from "./mail";
import { computeLicenseStatus } from "./license-status";

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const stripeSubscriptionId = session.subscription as string;
  const stripeCustomerId = session.customer as string;
  const email = (session.customer_email || session.customer_details?.email || "").toLowerCase();

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
  if (existingSubscription) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`checkout.session.completed: no User found for email ${email}`);
    return;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const subscriptionItem = stripeSubscription.items.data[0];
  if (!subscriptionItem) {
    console.error(`checkout.session.completed: subscription ${stripeSubscription.id} has no line items`);
    return;
  }
  const priceId = subscriptionItem.price.id;
  const plan = await prisma.plan.findFirst({
    where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }] },
  });
  if (!plan) {
    console.error(`checkout.session.completed: no Plan found for price ${priceId}`);
    return;
  }

  // Stripe API 2026-06-24.dahlia moved current_period_end from the Subscription
  // object down to each SubscriptionItem.
  const currentPeriodEnd = new Date(subscriptionItem.current_period_end * 1000);

  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      stripeSubscriptionId,
      stripeCustomerId,
      status: stripeSubscription.status,
      currentPeriodEnd,
    },
  });

  const existingLicense = await prisma.license.findFirst({ where: { userId: user.id } });

  let licenseKey: string;
  if (existingLicense) {
    const updated = await prisma.license.update({
      where: { id: existingLicense.id },
      data: { status: "active", planId: plan.id, validUntil: currentPeriodEnd },
    });
    licenseKey = updated.licenseKey;
  } else {
    licenseKey = await generateLicenseKey();
    const created = await prisma.license.create({
      data: {
        userId: user.id,
        licenseKey,
        status: "active",
        source: "stripe",
        planId: plan.id,
        validUntil: currentPeriodEnd,
      },
    });
    licenseKey = created.licenseKey;
  }

  await sendLicenseEmail(user.email, licenseKey);
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) {
    console.error(`customer.subscription.updated: no Subscription row for ${subscription.id}`);
    return;
  }

  // Stripe API 2026-06-24.dahlia moved current_period_end from the Subscription
  // object down to each SubscriptionItem.
  const subscriptionItem = subscription.items.data[0];
  if (!subscriptionItem) {
    console.error(`customer.subscription.updated: subscription ${subscription.id} has no line items`);
    return;
  }

  const now = new Date();
  const currentPeriodEnd = new Date(subscriptionItem.current_period_end * 1000);
  const pastDueSince = subscription.status === "past_due" ? existing.pastDueSince ?? now : null;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: subscription.status, currentPeriodEnd, pastDueSince },
  });

  const licenseStatus = computeLicenseStatus({
    subscriptionStatus: subscription.status,
    pastDueSince,
    now,
  });

  await prisma.license.updateMany({
    where: { userId: existing.userId },
    data: { status: licenseStatus, validUntil: currentPeriodEnd },
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!existing) {
    console.error(`customer.subscription.deleted: no Subscription row for ${subscription.id}`);
    return;
  }

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: "canceled" },
  });

  await prisma.license.updateMany({
    where: { userId: existing.userId },
    data: { status: "expired" },
  });
}

export async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Stripe API 2026-06-24.dahlia moved the subscription reference off the
  // Invoice object down to invoice.parent.subscription_details.subscription.
  const stripeSubscriptionId = (invoice.parent?.subscription_details?.subscription ?? null) as
    | string
    | null;
  if (!stripeSubscriptionId) {
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });
  if (!subscription) {
    console.error(`invoice.paid: no Subscription row for ${stripeSubscriptionId}`);
    return;
  }

  await prisma.order.create({
    data: {
      userId: subscription.userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status ?? "paid",
      refunded: false,
    },
  });
}
