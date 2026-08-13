"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingTierFeature } from "@/components/marketing/PricingTiers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/icons";

interface CheckoutViewProps {
  product: "metadata" | "agent";
  planName: string;
  priceLabel: string;
  /** Poin yang ikut di pembelian pertama. */
  poinAwal?: number | null;
  features: PricingTierFeature[];
  /** Saklar QRIS menyala DAN paket ini punya harga angka. */
  qrisTersedia?: boolean;
}

type Metode = "qris" | "bank";

export function CheckoutView({
  product,
  planName,
  priceLabel,
  poinAwal,
  features,
  qrisTersedia = false,
}: CheckoutViewProps) {
  const router = useRouter();
  const [contactNote, setContactNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [metode, setMetode] = useState<Metode>(qrisTersedia ? "qris" : "bank");

  async function handleBuy() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product,
        planName,
        // `durationMonths` sengaja TIDAK dikirim: server selalu menyimpan 1, dan
        // mengirimnya dari sini cuma memberi kesan nilainya bisa dipilih.
        contactNote: contactNote || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data.orderId) {
      setSubmitting(false);
      setError(data?.message || "Gagal membuat order. Coba lagi.");
      return;
    }

    if (metode === "qris") {
      // Tagihannya disiapkan sekarang, lalu pengguna dibawa LANGSUNG ke halaman
      // bayar — tanpa satu klik tambahan di halaman order.
      //
      // Tab yang sama, bukan jendela baru: `window.open` setelah rantai `await`
      // diblokir browser karena sudah lepas dari gestur kliknya. Kembali ke sini
      // lewat tombol back mendarat di halaman order, yang menyegarkan dirinya
      // sendiri saat difokuskan.
      //
      // Ordernya sudah ada di titik ini, jadi setiap jalan keluar di bawah
      // berakhir di halaman order — tempat QRIS bisa dicoba lagi dan transfer
      // manual tetap tersedia. Tidak ada jalan buntu.
      try {
        const bayar = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        });
        const hasil = await bayar.json().catch(() => null);
        if (bayar.ok && hasil?.ok && hasil.linkUrl) {
          window.location.href = hasil.linkUrl;
          return;
        }
      } catch {
        /* jaringan putus — jatuh ke halaman order di bawah */
      }
      router.push(`/order/${data.orderId}?bayar=qris`);
      return;
    }

    router.push(`/order/${data.orderId}?bayar=transfer`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Kiri — pilihan metode bayar. */}
      <div>
        <p className="font-mono text-label uppercase text-muted">Bayar dengan</p>
        <div className="mt-3 space-y-3">
          {qrisTersedia && (
            <MetodeKartu
              dipilih={metode === "qris"}
              onPilih={() => setMetode("qris")}
              ikon="phone"
              judul="QRIS"
              keterangan="Pindai dari aplikasi bank atau e-wallet apa pun. Paket aktif sendiri begitu pembayaran masuk."
            />
          )}
          <MetodeKartu
            dipilih={metode === "bank"}
            onPilih={() => setMetode("bank")}
            ikon="bank"
            judul="Transfer Bank"
            keterangan="Setelah kirim order, kami tampilkan nomor rekening tujuan. Paket aktif setelah admin mengonfirmasi."
          />
        </div>

        <Field
          id="contactNote"
          className="mt-6"
          label="Nomor WhatsApp (opsional) — agar tim kami mudah menghubungi Anda"
          type="text"
          value={contactNote}
          onChange={(e) => setContactNote(e.target.value)}
          placeholder="mis. 0812-3456-7890"
        />
      </div>

      {/* Kanan — ringkasan paket yang sedang dibeli. */}
      <Card>
        <p className="font-mono text-label uppercase text-muted">
          {product === "metadata" ? "Nerona Metadata" : "Nerona Agent"}
        </p>
        <h2 className="mt-1 text-title-2 text-ink">Paket {planName}</h2>
        <p className="mt-1 text-caption text-muted">
          Sekali bayar · akses selamanya
          {poinAwal ? (
            <>
              {" · "}
              <span className="font-mono tabular-nums">{poinAwal.toLocaleString("id-ID")}</span>{" "}
              poin
            </>
          ) : null}
        </p>

        <ul className="mt-4 space-y-2 text-body text-ink">
          {features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2">
              {/*
                Silang abu-abu, bukan merah: fitur yang tidak termasuk paket itu
                ketiadaan, bukan kesalahan. Warna status di sebelahnya membuat
                paket yang dipilih terlihat seperti pilihan yang salah.
              */}
              <Icon
                name={feature.included ? "check" : "close"}
                className={cn(
                  "mt-1 h-4 w-4 flex-none",
                  feature.included ? "text-accent" : "text-muted",
                )}
              />
              <span className={feature.included ? "" : "text-muted line-through"}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 border-t border-divider pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-body font-semibold text-ink">Total</span>
            <span className="font-mono text-title-2 tabular-nums text-ink">{priceLabel}</span>
          </div>
          {/*
            Dikatakan di tempat harganya, bukan cuma di kartu paket. Yang dibeli
            adalah AKSES, dan poinnya bekal awal — tanpa kalimat ini, pembeli
            membandingkan jumlah poin di sini dengan paket top-up dan
            menyimpulkan paket masuknya mahal.
          */}
          <p className="mt-1 text-right text-caption font-medium text-success">
            Bayar sekali, tidak ada tagihan bulanan
          </p>
        </div>

        {error && <p className="mt-4 text-body text-danger">{error}</p>}

        {/* Emas menandai aksi yang menggerakkan uang, dan di layar ini ialah
            satu-satunya. */}
        <Button
          variant="money"
          size="lg"
          full
          className="mt-5"
          onClick={handleBuy}
          disabled={submitting}
        >
          {submitting ? "Memproses..." : metode === "qris" ? "Bayar dengan QRIS" : "Beli"}
        </Button>
        <p className="mt-3 text-center text-caption text-muted">
          {metode === "qris"
            ? "Anda akan dibawa ke halaman QRIS. Paket aktif sendiri setelah pembayaran masuk."
            : "Pembayaran via transfer bank. Paket aktif setelah pembayaran dikonfirmasi admin."}
        </p>
      </Card>
    </div>
  );
}

/**
 * Kartu pilihan metode bayar.
 *
 * Garisnya setebal satu piksel di kedua keadaan, jadi memilih tidak menggeser
 * apa pun; yang membedakan hanya warna garis dan semburat latarnya. Ikonnya
 * dulu emoji, yang dirender sistem operasi — bentuk dan bobotnya berbeda di
 * tiap mesin dan tidak pernah ikut warna teks di sekitarnya.
 */
function MetodeKartu({
  dipilih,
  onPilih,
  ikon,
  judul,
  keterangan,
}: {
  dipilih: boolean;
  onPilih: () => void;
  ikon: IconName;
  judul: string;
  keterangan: string;
}) {
  return (
    <button
      type="button"
      onClick={onPilih}
      aria-pressed={dipilih}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border p-4 text-left transition",
        dipilih
          ? "border-accent bg-accent/5"
          : "border-border bg-surface hover:bg-surface-sunken",
      )}
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-chip bg-accent/10 text-accent">
        <Icon name={ikon} />
      </span>
      <div className="min-w-0">
        <p className="text-body font-semibold text-ink">{judul}</p>
        <p className="text-caption text-muted">{keterangan}</p>
      </div>
    </button>
  );
}
