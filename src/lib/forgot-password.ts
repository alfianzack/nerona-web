import { prisma } from "./prisma";
import { createPasswordResetToken } from "./tokens";
import { sendPasswordResetEmail } from "./mail";

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.password) {
    return;
  }
  const token = await createPasswordResetToken(user.id);
  await sendPasswordResetEmail(normalizedEmail, token);
}
