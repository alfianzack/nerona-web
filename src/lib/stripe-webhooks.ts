import type Stripe from "stripe";
import { prisma } from "./prisma";
import { stripe } from "./stripe";
import { generateLicenseKey } from "./license";
import { sendLicenseEmail } from "./mail";

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
  const priceId = subscriptionItem?.price.id;
  const plan = await prisma.plan.findFirst({
    where: { OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }] },
  });
  if (!plan) {
    console.error(`checkout.session.completed: no Plan found for price ${priceId}`);
    return;
  }

  // Stripe API 2026-06-24.dahlia moved current_period_end from the Subscription
  // object down to each SubscriptionItem.
  const currentPeriodEnd = new Date((subscriptionItem?.current_period_end ?? 0) * 1000);

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
