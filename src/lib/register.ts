import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { createEmailVerificationToken } from "./tokens";
import { sendVerificationEmail } from "./mail";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "weak_password" | "email_taken" };

export async function registerUser(email: string, password: string): Promise<RegisterResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "invalid_email" };
  }
  if (password.length < 8) {
    return { ok: false, error: "weak_password" };
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: false, error: "email_taken" };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, password: passwordHash },
  });

  const token = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(normalizedEmail, token);

  return { ok: true };
}
