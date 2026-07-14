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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
