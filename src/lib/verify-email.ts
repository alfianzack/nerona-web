import { prisma } from "./prisma";
import { consumeEmailVerificationToken } from "./tokens";

export type VerifyEmailResult = { ok: true } | { ok: false; error: "invalid_or_expired" };

export async function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  const consumed = await consumeEmailVerificationToken(token);
  if (!consumed) {
    return { ok: false, error: "invalid_or_expired" };
  }
  await prisma.user.update({
    where: { id: consumed.userId },
    data: { emailVerified: new Date() },
  });
  return { ok: true };
}
