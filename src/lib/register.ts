import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { createEmailVerificationToken } from "./tokens";
import { sendVerificationEmail } from "./mail";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "weak_password" | "invalid_phone" };

export interface RegisterProfile {
  name?: string;
  phone?: string;
}

export async function registerUser(
  email: string,
  password: string,
  profile: RegisterProfile = {}
): Promise<RegisterResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "invalid_email" };
  }
  if (password.length < 8) {
    return { ok: false, error: "weak_password" };
  }

  const name = profile.name?.trim().slice(0, 100) || undefined;
  const phone = profile.phone?.replace(/[\s()-]/g, "") || undefined;
  if (phone && !/^\+?\d{8,15}$/.test(phone)) {
    return { ok: false, error: "invalid_phone" };
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: true };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, password: passwordHash, name, phone },
  });

  const token = await createEmailVerificationToken(user.id);
  try {
    await sendVerificationEmail(normalizedEmail, token);
  } catch (err) {
    console.error("Failed to send verification email during registration:", err);
  }

  return { ok: true };
}
