import { NextResponse } from "next/server";
import { claimPairing } from "@/lib/device-pairing";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: Request) {
  const secret = bearerToken(request);
  if (!secret) return NextResponse.json({ ok: false }, { status: 401 });

  const result = await claimPairing(secret);
  if (result.status === "not_found") {
    return NextResponse.json({ ok: false, status: "not_found" }, { status: 404 });
  }
  if (result.status === "approved") {
    return NextResponse.json({ ok: true, status: "approved", token: result.token });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
