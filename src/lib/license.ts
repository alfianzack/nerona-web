import crypto from "node:crypto";
import { prisma } from "./prisma";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomGroup(length: number): string {
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

function candidateKey(): string {
  return `NERONA-${randomGroup(4)}-${randomGroup(4)}-${randomGroup(4)}`;
}

export async function generateLicenseKey(): Promise<string> {
  let key = candidateKey();
  while (await prisma.license.findUnique({ where: { licenseKey: key } })) {
    key = candidateKey();
  }
  return key;
}
