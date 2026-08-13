"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icons";

/**
 * Dua metode bayar yang saling menggantikan, bukan dua panel bertumpuk.
 *
 * Menampilkan keduanya sekaligus memaksa pengguna memilih tanpa diberi tahu
 * bahwa ia sedang memilih — dan yang paling sering terjadi adalah ia memindai
 * QRIS lalu ikut mentransfer manual juga, atau sebaliknya menunggu konfirmasi
 * admin atas pembayaran QRIS yang sudah otomatis.
 *
 * Penggantinya tetap ada dan satu klik jauhnya. Itu bukan hiasan: tautan QRIS
 * kedaluwarsa dalam <=24 jam, dan gateway bisa mati — tanpa jalan pindah,
 * pengguna terjebak di metode yang sedang tidak bekerja.
 */
export function PilihanPembayaran({
  qrisTersedia,
  awal,
  panelQris,
  panelTransfer,
}: {
  qrisTersedia: boolean;
  awal: "qris" | "transfer";
  panelQris: ReactNode;
  panelTransfer: ReactNode;
}) {
  const [aktif, setAktif] = useState<"qris" | "transfer">(
    qrisTersedia ? awal : "transfer"
  );

  if (!qrisTersedia) {
    return <>{panelTransfer}</>;
  }

  return (
    <section className="mt-6">
      {/* Pemilih ruas, bukan sederet pil: bentuk pil di dalam aplikasi hanya
          milik chip dan avatar. */}
      <div
        role="tablist"
        aria-label="Metode pembayaran"
        className="flex gap-1 rounded-control bg-surface-sunken p-1 ring-1 ring-border"
      >
        <Tab aktif={aktif === "qris"} onClick={() => setAktif("qris")}>
          <Icon name="phone" className="h-4 w-4" />
          QRIS
        </Tab>
        <Tab aktif={aktif === "transfer"} onClick={() => setAktif("transfer")}>
          <Icon name="bank" className="h-4 w-4" />
          Transfer bank
        </Tab>
      </div>

      <div className="mt-4">{aktif === "qris" ? panelQris : panelTransfer}</div>
    </section>
  );
}

function Tab({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={aktif}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-chip px-4 py-2 text-body font-medium transition",
        // Ruas terpilih naik ke permukaan lewat warna dan garis rambut saja;
        // bayangan disimpan untuk lapisan yang benar-benar melayang.
        aktif ? "bg-surface text-ink ring-1 ring-border" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
