import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { baseUrl } from "./base-url";

export type CheckoutInterval = "monthly" | "yearly";

export async function createCheckoutSession(
  email: string,
  interval: CheckoutInterval
): Promise<{ url: string } | null> {
  const plan = await prisma.plan.findFirst();
  if (!plan) {
    return null;
  }

  const priceId = interval === "monthly" ? plan.stripePriceIdMonthly : plan.stripePriceIdYearly;
  if (!priceId) {
    return null;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl()}/account`,
    cancel_url: `${baseUrl()}/pricing`,
  });

  if (!session.url) {
    return null;
  }
  return { url: session.url };
}
