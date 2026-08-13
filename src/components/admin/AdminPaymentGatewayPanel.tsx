"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Keadaan {
  enabled: boolean;
  /** Kunci API sudah terpasang di server. */
  configured: boolean;
  sandbox: boolean;
  /** ISO waktu webhook terakhir yang lolos verifikasi; `null` = belum pernah. */
  webhookLastOk: string | null;
  /** Kegagalan gateway terakhir apa adanya. Hanya admin yang melihat ini. */
  lastFailure: { waktu: string; pesan: string } | null;
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
      lastFailure: data.lastFailure ?? null,
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
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-chip bg-brand-sky/25 text-brand-sky-ink">
          {/* Daftar Icon belum punya glyph kode QR, jadi gambarnya tetap di
              sini. Warnanya diwarisi dari warna teks induknya, bukan ditulis di
              SVG-nya, supaya ia ikut token seperti ikon lain. */}
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
          <h2 className="text-title-2 text-ink">Pembayaran QRIS</h2>
          <p className="text-caption text-muted">SumoPod Managed Payment</p>
        </div>
      </div>

      {galat && <p className="mt-2 text-body text-danger">{galat}</p>}

      {keadaan === null ? (
        <p className="mt-4 text-body text-muted">Memuat…</p>
      ) : (
        <>
          <Card
            variant="sunken"
            padding="sm"
            className="mt-4 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">
                {keadaan.enabled ? "Menyala" : "Mati"}
              </p>
              <p className="mt-0.5 text-caption text-muted">
                {keadaan.enabled
                  ? "Tombol Bayar dengan QRIS tampil di halaman order."
                  : "Pelanggan hanya melihat transfer manual."}
              </p>
            </div>
            {/*
              Saklar ini tidak memindahkan uang siapa pun — ia hanya menentukan
              tombol mana yang tampil ke pelanggan — jadi tidak ada emas di sini.
              Menyalakan adalah aksi utamanya; mematikan adalah langkah mundur
              yang harus tetap mudah dijangkau tapi tidak menarik jari.
            */}
            <Button
              variant={keadaan.enabled ? "secondary" : "primary"}
              onClick={() => ubah(!keadaan.enabled)}
              disabled={sibuk || (!keadaan.configured && !keadaan.enabled)}
            >
              {sibuk ? "Menyimpan..." : keadaan.enabled ? "Matikan" : "Nyalakan"}
            </Button>
          </Card>

          {/*
            Membedakan "saklarnya mati" dari "kuncinya belum ada". Tanpa baris
            ini, satu-satunya gejala kunci yang belum dipasang adalah tombol QRIS
            yang tidak muncul — tanpa sebab yang bisa dilihat siapa pun.
          */}
          {!keadaan.configured && (
            <p className="mt-3 rounded-card bg-danger-bg p-3 text-caption text-ink ring-1 ring-danger/25">
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
              className={`mt-3 rounded-card p-3 text-caption text-ink ring-1 ${
                keadaan.webhookLastOk
                  ? "bg-success-bg ring-success/25"
                  : "bg-danger-bg ring-danger/25"
              }`}
            >
              {keadaan.webhookLastOk ? (
                <>
                  Webhook terverifikasi terakhir{" "}
                  <b className="font-mono tabular-nums">
                    {new Date(keadaan.webhookLastOk).toLocaleString("id-ID")}
                  </b>
                  .
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
              className={`mt-3 rounded-card p-3 text-caption text-ink ring-1 ${
                keadaan.sandbox
                  ? "bg-warning-bg ring-warning/25"
                  : "bg-success-bg ring-success/25"
              }`}
            >
              {keadaan.sandbox
                ? "Mode SANDBOX — pembayaran tidak nyata dan tidak ada uang yang masuk."
                : "Mode LIVE — pembayaran menagih uang sungguhan."}
            </p>
          )}

          {/*
            Pelanggan hanya melihat 502, dan itu memang benar — pesan galat
            mentah pihak ketiga tidak boleh sampai ke browser mereka. Tapi
            seseorang harus bisa melihatnya tanpa memburu log Vercel, kalau
            tidak setiap kegagalan jadi satu putaran tebak-menebak lagi.
          */}
          {keadaan.lastFailure && (
            <Card variant="sunken" padding="sm" className="mt-3">
              <p className="font-mono text-label uppercase text-muted">
                Kegagalan terakhir dari gateway ·{" "}
                {new Date(keadaan.lastFailure.waktu).toLocaleString("id-ID")}
              </p>
              <code className="mt-1.5 block break-all font-mono text-caption leading-relaxed text-muted">
                {keadaan.lastFailure.pesan}
              </code>
              <p className="mt-1.5 text-caption text-muted">
                <b>401</b> biasanya kunci API salah, atau kunci sandbox dipakai ke alamat live
                (dan sebaliknya). <b>400</b> biasanya jumlah atau{" "}
                <code>payment_method_type_code</code> — bisa ditimpa lewat{" "}
                <code>SUMOPOD_PAY_METHOD_CODE</code> tanpa deploy kode.
              </p>
            </Card>
          )}

          <p className="mt-3 text-caption text-muted">
            Mematikan saklar ini tidak membatalkan tagihan QRIS yang sudah terlanjur dibuat;
            yang sudah dibayar tetap diproses webhook seperti biasa.
          </p>
        </>
      )}
    </Card>
  );
}
