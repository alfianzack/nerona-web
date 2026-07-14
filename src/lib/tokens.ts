import crypto from "node:crypto";
import { prisma } from "./prisma";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: { userId, token, expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
  });
  return token;
}

export async function consumeEmailVerificationToken(
  token: string
): Promise<{ userId: string } | null> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return null;
  }
  await prisma.emailVerificationToken.delete({ where: { token } });
  return { userId: record.userId };
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId, token, expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
  });
  return token;
}

export async function consumePasswordResetToken(
  token: string
): Promise<{ userId: string } | null> {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return null;
  }
  await prisma.passwordResetToken.delete({ where: { token } });
  return { userId: record.userId };
}
