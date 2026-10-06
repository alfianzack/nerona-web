import { resolveExtensionToken } from "@/lib/extension-auth";

/** Pemilik token Bearer extension/Hub, atau null. userId TIDAK pernah dibaca dari badan permintaan. */
export async function tokenUser(request: Request): Promise<string | null> {
  const cocok = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  const hasil = cocok ? await resolveExtensionToken(cocok[1].trim()) : null;
  return hasil?.userId ?? null;
}
