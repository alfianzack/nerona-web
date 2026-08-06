"use client";

import { useState, type ReactNode } from "react";

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
      <div
        role="tablist"
        aria-label="Metode pembayaran"
        className="flex gap-2 rounded-full bg-navy-900/5 p-1 ring-1 ring-navy-900/10"
      >
        <Tab aktif={aktif === "qris"} onClick={() => setAktif("qris")}>
          📱 QRIS
        </Tab>
        <Tab aktif={aktif === "transfer"} onClick={() => setAktif("transfer")}>
          🏦 Transfer bank
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
      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
        aktif ? "bg-surface text-ink shadow-sm ring-1 ring-navy-900/10" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
