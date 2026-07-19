import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export function normalizePhone(input: string): string {
  const digits = input.trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    return digits;
  }
  if (digits.startsWith("62")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+62${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export async function findProfileByPhone(phone: string) {
  return prisma.agentProfile.findUnique({ where: { whatsappPhone: phone } });
}

export async function getOwnProfile(userId: string) {
  return prisma.agentProfile.findUnique({ where: { userId } });
}

export type StartPhoneLinkResult =
  | { ok: true; code: string; expires: Date }
  | { ok: false; reason: "phone_taken" };

function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function startPhoneLink(
  profileId: string,
  phone: string
): Promise<StartPhoneLinkResult> {
  const existing = await prisma.agentProfile.findUnique({ where: { whatsappPhone: phone } });
  if (existing && existing.id !== profileId) {
    return { ok: false, reason: "phone_taken" };
  }

  const code = generateSixDigitCode();
  const expires = new Date(Date.now() + LINK_CODE_TTL_MS);

  try {
    await prisma.agentProfile.update({
      where: { id: profileId },
      data: {
        whatsappPhone: phone,
        phoneVerifiedAt: null,
        linkCode: code,
        linkCodeExpires: expires,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "phone_taken" };
    }
    throw err;
  }

  return { ok: true, code, expires };
}

export function matchesLinkCode(
  profile: { linkCode: string | null; linkCodeExpires: Date | null },
  text: string
): boolean {
  if (!profile.linkCode || !profile.linkCodeExpires) {
    return false;
  }
  if (profile.linkCodeExpires.getTime() < Date.now()) {
    return false;
  }
  return text.trim() === profile.linkCode;
}

export async function markPhoneVerified(profileId: string): Promise<void> {
  await prisma.agentProfile.update({
    where: { id: profileId },
    data: { phoneVerifiedAt: new Date(), linkCode: null, linkCodeExpires: null },
  });
}
