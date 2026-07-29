"use client";

import { useEffect, useState } from "react";

interface TokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ExtensionConnectPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [created, setCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/extension/tokens");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) setTokens(data.tokens);
  }
  useEffect(() => {
    load();
  }, []);

  async function createToken() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Extension" }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.ok) {
      setError("Gagal membuat token.");
      return;
    }
    setCreated(data.token);
    load();
  }

  async function revoke(id: string) {
    setError("");
    const res = await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Gagal mencabut token. Muat ulang halaman lalu coba lagi.");
      return;
    }
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Hubungkan Extension</h2>
      <p className="mt-1 text-sm text-muted">
        Tiga langkah: unduh extension, pasang di Chrome, lalu tempel token di popup-nya.
      </p>

      {/*
        Extension Nerona Metadata tidak ada di Chrome Web Store, jadi manifest-nya
        tanpa `update_url` dan pemasangannya lewat "Muat yang belum dikemas".
        Artinya TIDAK ADA pembaruan otomatis: setiap rilis baru, user harus
        mengunduh ZIP ini lagi dan menimpa foldernya.

        ZIP di /public dibangun dari repo nerona_medata dan ikut ter-commit sebagai
        artefak. Kalau extension-nya berubah, ZIP ini TIDAK ikut berubah sendiri —
        harus dibangun ulang, kalau tidak user mengunduh versi lama tanpa tanda apa pun.
      */}
      <div className="mt-4 rounded-2xl bg-navy-900/[0.03] p-4 ring-1 ring-navy-900/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">1. Unduh extension</p>
            <p className="mt-0.5 text-xs text-muted">
              Berisi extension untuk Chrome. Simpan lalu ekstrak — foldernya jangan dihapus,
              Chrome memuatnya langsung dari situ.
            </p>
          </div>
          <a
            href="/nerona-metadata.zip"
            download
            className="whitespace-nowrap rounded-full bg-navy-900/5 px-4 py-2 text-sm font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
          >
            Unduh ZIP
          </a>
        </div>

        <p className="mt-4 text-sm font-semibold text-ink">2. Pasang di Chrome</p>
        <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-muted">
          <li>
            Ekstrak ZIP-nya ke folder tetap — misalnya <code>Documents\Nerona</code>.
          </li>
          <li>
            Buka <code>chrome://extensions</code>, lalu nyalakan <b>Developer mode</b> di kanan atas.
          </li>
          <li>
            Klik <b>Load unpacked</b> / <b>Muat yang belum dikemas</b>, pilih folder hasil ekstrak
            (folder yang berisi <code>manifest.json</code>).
          </li>
          <li>
            Kalau nanti ada versi baru: unduh lagi, timpa isi folder itu, lalu klik ikon{" "}
            <b>⟳ Reload</b> di kartu extension-nya — pembaruan tidak otomatis.
          </li>
        </ol>

        <p className="mt-4 text-sm font-semibold text-ink">3. Tempel token di popup extension</p>
        <p className="mt-0.5 text-xs text-muted">
          Buat token di bawah ini, salin, lalu buka popup extension dan tempel di sana.
        </p>
      </div>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      {created && (
        <div className="mt-4 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
          <p className="text-xs font-semibold text-ink">Token baru (salin sekarang — tidak ditampilkan lagi):</p>
          <code className="mt-1 block break-all text-sm text-ink">{created}</code>
        </div>
      )}

      <button
        onClick={createToken}
        disabled={loading}
        className="mt-4 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Membuat..." : "Buat token"}
      </button>

      <ul className="mt-4 divide-y divide-navy-900/10">
        {tokens.length === 0 && <li className="py-2 text-sm text-muted">Belum ada token.</li>}
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{t.label || "Token"}</p>
              <p className="text-xs text-muted">
                Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID")}
                {t.lastUsedAt ? ` · dipakai ${new Date(t.lastUsedAt).toLocaleDateString("id-ID")}` : " · belum dipakai"}
              </p>
            </div>
            <button
              onClick={() => revoke(t.id)}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Cabut
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
