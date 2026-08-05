"use client";

import { useState } from "react";

const PESAN: Record<string, string> = {
  not_found: "Kode tidak dikenal. Periksa lagi kode yang tampil di Nerona Hub.",
  expired: "Kode sudah kedaluwarsa. Klik Hubungkan akun lagi di Nerona Hub untuk kode baru.",
  already_handled: "Kode ini sudah dipakai. Minta kode baru dari Nerona Hub.",
};

export function FormPersetujuan({ kodeAwal }: { kodeAwal: string }) {
  const [kode, setKode] = useState(kodeAwal);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<"" | "disetujui" | "ditolak">("");
  const [galat, setGalat] = useState("");

  async function kirim(setuju: boolean) {
    setGalat("");
    setSibuk(true);
    const res = await fetch("/api/extension/pair/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: kode, setuju }),
    });
    const data = await res.json().catch(() => null);
    setSibuk(false);
    if (!res.ok || !data?.ok) {
      setGalat(PESAN[data?.reason] || "Gagal memproses kode. Coba lagi.");
      return;
    }
    setHasil(setuju ? "disetujui" : "ditolak");
  }

  if (hasil === "disetujui") {
    return (
      <p className="text-sm text-ink">
        ✓ Tersambung. Kembali ke Nerona Hub — layarnya akan berubah sendiri dalam
        beberapa detik. Tab ini boleh ditutup.
      </p>
    );
  }
  if (hasil === "ditolak") {
    return <p className="text-sm text-ink">Permintaan ditolak. Tidak ada akses yang diberikan.</p>;
  }

  return (
    <>
      <label htmlFor="kode" className="text-xs font-semibold text-muted">
        Kode dari Nerona Hub
      </label>
      <input
        id="kode"
        value={kode}
        onChange={(e) => setKode(e.target.value)}
        placeholder="4KQ9-7ZTM"
        autoComplete="off"
        className="mt-1 w-full rounded-2xl bg-navy-900/[0.03] px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] text-ink ring-1 ring-navy-900/10"
      />
      {galat && <p className="mt-3 text-sm text-rose-500">{galat}</p>}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => kirim(true)}
          disabled={sibuk || !kode.trim()}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-5 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {sibuk ? "Memproses..." : "Setujui"}
        </button>
        <button
          onClick={() => kirim(false)}
          disabled={sibuk || !kode.trim()}
          className="rounded-full bg-navy-900/5 px-5 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
        >
          Tolak
        </button>
      </div>
    </>
  );
}
