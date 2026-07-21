import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";

export interface ProfileUpdate {
  name?: string | null;
  phone?: string | null;
  businessName?: string | null;
}

export async function updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.phone !== undefined ? { phone: update.phone } : {}),
      ...(update.businessName !== undefined ? { businessName: update.businessName } : {}),
    },
  });
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "no_password" | "wrong_password" };

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!user?.password) {
    return { ok: false, reason: "no_password" };
  }
  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) {
    return { ok: false, reason: "wrong_password" };
  }
  const hash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });
  return { ok: true };
}
