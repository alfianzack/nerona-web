import { NextResponse } from "next/server";
import { tautanAman } from "@/lib/unduhan";
import { updateUnduhanSettings } from "@/lib/unduhan-settings";
import type { UnduhanSettings } from "@/lib/unduhan";

/**
 * Dipanggil CI setelah installer/ZIP benar-benar terunggah ke repo rilis, supaya
 * `/unduh` tidak lagi menuntut siapa pun mengetik lima kolom dengan tangan.
 *
 * Auth-nya meniru pola `CRON_SECRET` di `api/agent/cron`, tapi env-nya terpisah:
 * bocornya satu tidak boleh memberi yang lain.
 *
 * Berbeda dari `api/admin/download-settings`, rute ini **memvalidasi URL sebelum
 * menyimpan**. Itu bukan pembatalan aturan "validasi di titik render" — penjaga
 * render tetap ada apa adanya. Bedanya: admin manusia berhak menyimpan nilai
 * setengah jadi lalu membetulkannya, sedangkan mesin tidak pernah punya alasan
 * menulis URL cacat. Kalau ia menulisnya, kita ingin CI merah hari itu juga,
 * bukan tombol mati yang baru ketahuan dari keluhan pengguna.
 */

function tolak(pesan: string) {
  return NextResponse.json({ ok: false, message: pesan }, { status: 400 });
}

export async function POST(request: Request) {
  const rahasia = process.env.RELEASE_SECRET;
  const header = request.headers.get("authorization");
  // `!rahasia` lebih dulu: env yang belum diset berarti pintu tertutup untuk
  // semua orang, bukan pintu terbuka.
  if (!rahasia || header !== `Bearer ${rahasia}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return tolak("Permintaan tidak valid.");
  }

  // Kunci kebijakan tidak pernah boleh datang dari build. Ditolak, bukan
  // diabaikan diam-diam: CI yang mengirimnya sedang salah paham, dan salah
  // paham yang dibiarkan lewat akan diulang.
  if ("extensionMinVersion" in body || "extension_min_version" in body) {
    return tolak("extension_min_version adalah kebijakan owner, bukan hasil build.");
  }

  const versi = typeof body.versi === "string" ? body.versi.trim() : "";
  if (!versi) return tolak("Versi wajib diisi.");

  const aset = body.aset && typeof body.aset === "object" ? body.aset : {};
  // URL diambil dari yang GitHub laporkan (`gh release view --json assets`),
  // bukan dari nama berkas lokal: GitHub menormalkan spasi jadi titik, dan URL
  // yang dikarang dari nama lokal akan 404 di setiap mesin pengguna.
  const url = (nama: string): string | null => tautanAman(aset[nama]);

  let nilai: Partial<UnduhanSettings>;

  if (body.produk === "hub") {
    const windows = url("windows");
    const mac = url("mac");
    // Keduanya wajib. Rilis Hub yang cuma punya .msi berarti build macOS gagal,
    // dan menyimpan separuhnya membiarkan tombol Mac menunjuk versi lama sambil
    // halaman mengaku sudah versi baru.
    if (!windows || !mac) return tolak("Rilis Hub butuh URL installer Windows dan macOS yang sah.");
    nilai = { hubWindowsUrl: windows, hubMacUrl: mac, hubVersion: versi };
  } else if (body.produk === "extension") {
    const zip = url("zip");
    if (!zip) return tolak("Rilis extension butuh URL ZIP yang sah.");
    nilai = { extensionUrl: zip, extensionVersion: versi };
  } else {
    return tolak('Produk harus "hub" atau "extension".');
  }

  await updateUnduhanSettings(nilai);
  return NextResponse.json({ ok: true, produk: body.produk, versi });
}
