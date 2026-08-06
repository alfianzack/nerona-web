import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUnduhanSettings, updateUnduhanSettings } from "@/lib/unduhan-settings";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, settings: await getUnduhanSettings() });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  // URL-nya TIDAK divalidasi di sini. Admin harus bisa menyimpan nilai setengah
  // jadi lalu membetulkannya, dan yang menentukan sebuah URL boleh jadi `href`
  // adalah `tautanAman` di titik render — satu penjaga, di tempat bahayanya
  // sungguh ada. Menolak simpan di sini cuma menambah tempat kedua yang harus
  // ikut berubah kalau aturannya bergeser.
  await updateUnduhanSettings({
    hubWindowsUrl: asString(body.hubWindowsUrl),
    hubMacUrl: asString(body.hubMacUrl),
    hubVersion: asString(body.hubVersion),
    extensionUrl: asString(body.extensionUrl),
    extensionVersion: asString(body.extensionVersion),
  });

  return NextResponse.json({ ok: true });
}
