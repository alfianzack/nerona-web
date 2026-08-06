"use client";

import { useEffect, useState } from "react";

interface Keadaan {
  enabled: boolean;
  /** Kunci API sudah terpasang di server. */
  configured: boolean;
  sandbox: boolean;
  /** ISO waktu webhook terakhir yang lolos verifikasi; `null` = belum pernah. */
  webhookLastOk: string | null;
}

/**
 * Saklar pembayaran QRIS.
 *
 * Ada di `Setting`, bukan env, justru supaya bisa dimatikan TANPA deploy: kalau
 * gateway-nya bermasalah di tengah hari, satu klik di sini membuat semua
 * pelanggan jatuh ke transfer manual yang memang tetap ada.
 */
export function AdminPaymentGatewayPanel() {
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function muat() {
    const res = await fetch("/api/admin/payment-gateway");
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setGalat("Gagal memuat status pembayaran.");
      return;
    }
    setKeadaan({
      enabled: data.enabled,
      configured: data.configured,
      sandbox: data.sandbox,
      webhookLastOk: data.webhookLastOk ?? null,
    });
  }

  useEffect(() => {
    muat();
  }, []);

  async function ubah(nyala: boolean) {
    setGalat("");
    setSibuk(true);
    const res = await fetch("/api/admin/payment-gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nyala }),
    });
    setSibuk(false);
    if (!res.ok) {
      setGalat("Gagal menyimpan. Coba lagi.");
      return;
    }
    setKeadaan((k) => (k ? { ...k, enabled: nyala } : k));
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-sky/25 text-[#1F7FAE]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink">Pembayaran QRIS</h2>
          <p className="text-xs text-muted">SumoPod Managed Payment</p>
        </div>
      </div>

      {galat && <p className="mt-2 text-sm text-rose-500">{galat}</p>}

      {keadaan === null ? (
        <p className="mt-4 text-sm text-muted">Memuat…</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-navy-900/[0.03] p-3 ring-1 ring-navy-900/10">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {keadaan.enabled ? "Menyala" : "Mati"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {keadaan.enabled
                  ? "Tombol Bayar dengan QRIS tampil di halaman order."
                  : "Pelanggan hanya melihat transfer manual."}
              </p>
            </div>
            <button
              onClick={() => ubah(!keadaan.enabled)}
              disabled={sibuk || (!keadaan.configured && !keadaan.enabled)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                keadaan.enabled
                  ? "bg-navy-900/5 text-ink ring-1 ring-navy-900/10 hover:bg-navy-900/10"
                  : "bg-gradient-to-br from-gold-500 to-gold-400 text-navy-900 hover:brightness-110"
              }`}
            >
              {sibuk ? "Menyimpan..." : keadaan.enabled ? "Matikan" : "Nyalakan"}
            </button>
          </div>

          {/*
            Membedakan "saklarnya mati" dari "kuncinya belum ada". Tanpa baris
            ini, satu-satunya gejala kunci yang belum dipasang adalah tombol QRIS
            yang tidak muncul — tanpa sebab yang bisa dilihat siapa pun.
          */}
          {!keadaan.configured && (
            <p className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-ink ring-1 ring-rose-500/30">
              Kunci API belum terpasang di server. Isi <code>SUMOPOD_PAY_API_BASE</code>,{" "}
              <code>SUMOPOD_PAY_API_KEY</code>, dan <code>SUMOPOD_PAY_WEBHOOK_SECRET</code> di
              environment, lalu deploy ulang. Saklar ini tidak bisa dinyalakan sebelum itu.
            </p>
          )}

          {/*
            Syarat yang paling mudah terlewat, dan akibatnya paling mahal:
            QRIS yang menyala sementara webhook masih ditolak berarti pelanggan
            membayar sungguhan dan paketnya tidak pernah aktif — karena yang
            mengaktifkannya adalah webhook, bukan pembayarannya.
          */}
          {keadaan.configured && (
            <p
              className={`mt-3 rounded-xl p-3 text-xs ring-1 ${
                keadaan.webhookLastOk
                  ? "bg-emerald-500/10 text-ink ring-emerald-500/30"
                  : "bg-rose-500/10 text-ink ring-rose-500/30"
              }`}
            >
              {keadaan.webhookLastOk ? (
                <>
                  Webhook terverifikasi terakhir{" "}
                  <b>{new Date(keadaan.webhookLastOk).toLocaleString("id-ID")}</b>.
                </>
              ) : (
                <>
                  <b>Belum ada satu webhook pun yang lolos verifikasi.</b> Kirim{" "}
                  <code>payment.test</code> dari dashboard SumoPod lebih dulu. Menyalakan QRIS
                  sekarang berarti pelanggan bisa membayar tanpa paketnya pernah aktif.
                </>
              )}
            </p>
          )}

          {keadaan.configured && (
            <p
              className={`mt-3 rounded-xl p-3 text-xs ring-1 ${
                keadaan.sandbox
                  ? "bg-gold-400/15 text-ink ring-gold-400/40"
                  : "bg-emerald-500/10 text-ink ring-emerald-500/30"
              }`}
            >
              {keadaan.sandbox
                ? "Mode SANDBOX — pembayaran tidak nyata dan tidak ada uang yang masuk."
                : "Mode LIVE — pembayaran menagih uang sungguhan."}
            </p>
          )}

          <p className="mt-3 text-[11px] text-muted/80">
            Mematikan saklar ini tidak membatalkan tagihan QRIS yang sudah terlanjur dibuat;
            yang sudah dibayar tetap diproses webhook seperti biasa.
          </p>
        </>
      )}
    </div>
  );
}
