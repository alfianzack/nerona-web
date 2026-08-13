"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/icons";

const PESAN: Record<string, string> = {
  not_found: "Kode tidak dikenal. Periksa lagi kode yang tampil di Nerona Hub.",
  expired: "Kode sudah kedaluwarsa. Klik Hubungkan akun lagi di Nerona Hub untuk kode baru.",
  already_handled: "Kode ini sudah dipakai. Minta kode baru dari Nerona Hub.",
  too_many:
    "Terlalu banyak percobaan. Tunggu sekitar 10 menit, lalu buka lagi tautan ini dari Nerona Hub.",
  // Menyebut paket yang dibutuhkan, bukan sekadar "tidak diizinkan": tanpa itu
  // pengguna akan mencoba lagi dengan kode baru dan gagal dengan cara yang
  // sama, lalu menyimpulkan aplikasinya rusak.
  plan_required:
    "Paket Anda belum termasuk Nerona Hub. Hub tersedia di paket Business — lihat halaman Harga untuk berpindah paket.",
};

export function FormPersetujuan({ kodeAwal }: { kodeAwal: string }) {
  const [kode, setKode] = useState(kodeAwal);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<"" | "disetujui" | "ditolak">("");
  const [galat, setGalat] = useState("");

  async function kirim(setuju: boolean) {
    setGalat("");
    setSibuk(true);
    try {
      const res = await fetch("/api/extension/pair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: kode, setuju }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setGalat(PESAN[data?.reason] || "Gagal memproses kode. Coba lagi.");
        return;
      }
      setHasil(setuju ? "disetujui" : "ditolak");
    } catch {
      setGalat("Koneksi terputus. Periksa internet Anda lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  if (hasil === "disetujui") {
    return (
      <p className="flex items-start gap-2.5 text-body text-ink">
        {/* Centangnya dulu glyph teks di dalam kalimat. Glyph dirender oleh font
            sistem, jadi tinggi dan tebalnya berbeda-beda antar mesin dan tidak
            bisa disetel mengikuti warna status. */}
        <Icon name="check-circle" className="mt-0.5 h-4 w-4 flex-none text-success" />
        <span>
          Tersambung. Kembali ke Nerona Hub — layarnya akan berubah sendiri dalam beberapa
          detik. Tab ini boleh ditutup.
        </span>
      </p>
    );
  }
  if (hasil === "ditolak") {
    return <p className="text-body text-ink">Permintaan ditolak. Tidak ada akses yang diberikan.</p>;
  }

  return (
    <>
      <label htmlFor="kode" className="font-mono text-label uppercase text-muted">
        Kode dari Nerona Hub
      </label>
      {/* Kode pasangan adalah ID, jadi mono dengan jarak huruf lebar: yang
          dicocokkan mata adalah karakter per karakter dengan layar Hub, dan
          huruf proporsional membuat 0/O dan 1/I saling menyamar. */}
      <Input
        id="kode"
        value={kode}
        onChange={(e) => setKode(e.target.value)}
        placeholder="4KQ9-7ZTM"
        autoComplete="off"
        className="mt-1.5 text-center font-mono tracking-[0.3em] tabular-nums"
      />
      {galat && <p className="mt-3 text-caption text-danger">{galat}</p>}
      <div className="mt-4 flex gap-3">
        <Button onClick={() => kirim(true)} disabled={sibuk || !kode.trim()}>
          {sibuk ? "Memproses..." : "Setujui"}
        </Button>
        {/* Tolak sengaja bukan varian bahaya. Menolak justru langkah yang aman
            di sini — merah akan membacanya terbalik, seolah menolak yang
            berisiko. */}
        <Button variant="secondary" onClick={() => kirim(false)} disabled={sibuk || !kode.trim()}>
          Tolak
        </Button>
      </div>
    </>
  );
}
