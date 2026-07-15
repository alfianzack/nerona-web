import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { baseUrl } from "./base-url";

export async function createBillingPortalSession(userId: string): Promise<{ url: string } | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) {
    return null;
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl()}/account`,
  });

  return { url: portalSession.url };
}
