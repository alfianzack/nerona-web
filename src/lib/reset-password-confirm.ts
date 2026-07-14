import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { consumePasswordResetToken } from "./tokens";

export type ConfirmResetResult =
  | { ok: true }
  | { ok: false; error: "invalid_or_expired" | "weak_password" };

export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<ConfirmResetResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: "weak_password" };
  }

  const consumed = await consumePasswordResetToken(token);
  if (!consumed) {
    return { ok: false, error: "invalid_or_expired" };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: consumed.userId },
    data: { password: passwordHash },
  });

  return { ok: true };
}
