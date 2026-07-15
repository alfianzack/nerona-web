import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_ADMIN_EMAIL;
  if (!ownerEmail) {
    throw new Error("Set OWNER_ADMIN_EMAIL in .env.local before running the seed script.");
  }

  const user = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail },
  });

  await prisma.adminRole.upsert({
    where: { userId: user.id },
    update: { role: "owner_admin" },
    create: { userId: user.id, role: "owner_admin" },
  });

  console.log(`Granted owner_admin to ${ownerEmail}`);

  const priceIdMonthly = process.env.STRIPE_PRICE_ID_MONTHLY;
  const priceIdYearly = process.env.STRIPE_PRICE_ID_YEARLY;
  if (!priceIdMonthly || !priceIdYearly) {
    throw new Error(
      "Set STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_YEARLY in .env.local before running the seed script."
    );
  }

  const existingPlan = await prisma.plan.findFirst({ where: { name: "Pro" } });
  if (existingPlan) {
    await prisma.plan.update({
      where: { id: existingPlan.id },
      data: { stripePriceIdMonthly: priceIdMonthly, stripePriceIdYearly: priceIdYearly },
    });
  } else {
    await prisma.plan.create({
      data: {
        name: "Pro",
        stripePriceIdMonthly: priceIdMonthly,
        stripePriceIdYearly: priceIdYearly,
        marketplaces: "*",
        rejectAnalyzer: true,
      },
    });
  }

  console.log("Seeded Pro plan");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
