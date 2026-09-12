"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

/**
 * Tiga bentuk, karena tombol ini sekarang berdiri di tiga tempat yang bentuk
 * dan LATARNYA berbeda — bukan karena ada tiga selera.
 *
 * - `chip` — bar ramping di bawah `sm`, satu-satunya sisa topbar lama. Latarnya
 *   canvas putih, jadi ia memakai token terang apa adanya.
 * - `row`  — puncak sidebar berlabel (`xl`+) dan laci. Ada ruang untuk alamat
 *   surel, jadi identitasnya dibaca tanpa perlu diklik dulu.
 * - `rail` — puncak strip 56px. Hanya inisial yang muat.
 *
 * Arah panelnya ikut bentuk, dan itu bukan hiasan: panel selebar 208px yang
 * jatuh ke bawah di dalam strip 56px akan menjorok keluar rail dan terpotong
 * tepi jendela di layar sempit, jadi `rail` melemparkannya ke SAMPING.
 */
type AccountMenuVariant = "chip" | "row" | "rail";

export function AccountMenu({
  email,
  variant = "chip",
}: {
  email: string;
  variant?: AccountMenuVariant;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function handleSignOut() {
    setSigningOut(true);
    signOut({ callbackUrl: "/" });
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";
  const onNavy = variant !== "chip";

  // Inisialnya dibalik dengan tangan untuk permukaan gelap, sama seperti yang
  // sudah dilakukan hero: token `ink` dan `border` dua-duanya dipilih untuk
  // berdiri di atas putih.
  const avatar = (
    <span
      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-caption font-semibold ${
        onNavy ? "text-white ring-1 ring-white/25" : "text-ink ring-1 ring-border"
      }`}
    >
      {initial}
    </span>
  );

  const trigger =
    variant === "row" ? (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu akun"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition hover:bg-white/10"
      >
        {avatar}
        {/* min-w-0 pada pembungkusnya, bukan cuma truncate pada teksnya: tanpa
            itu butir flex menolak menyusut di bawah lebar isinya dan alamat
            surel panjang justru melebarkan seluruh baris. */}
        <span className="min-w-0 flex-1 truncate font-mono text-caption text-navy-100">
          {email}
        </span>
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          className="h-3.5 w-3.5 flex-none text-navy-100"
        />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu akun"
        aria-expanded={open}
        title={variant === "rail" ? email : undefined}
        className={`flex items-center justify-center rounded-full transition ${
          onNavy ? "hover:opacity-80" : "hover:bg-surface-sunken"
        }`}
      >
        {avatar}
      </button>
    );

  // Panelnya tetap kartu PUTIH melayang di ketiga bentuk. Di atas navy itu
  // memang yang benar — preseden yang sama dengan kartu contoh di atas hero:
  // permukaan terang yang mengapung terbaca sebagai lapisan di atas, bukan
  // sebagai tambalan.
  const panelPlacement =
    variant === "rail"
      ? "left-full top-0 ml-2 w-52"
      : variant === "row"
        ? "left-0 right-0 mt-2"
        : "right-0 mt-2 w-52";

  return (
    <>
      <div className="relative">
        {trigger}

        {open && (
          <>
            {/* Click-away catcher — the dropdown is small enough not to need
                focus trapping, but it must not stay open behind a navigation. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            {/* Satu-satunya lapisan di kerangka aplikasi yang benar-benar
                melayang, jadi satu-satunya yang boleh berbayang. Kartu diam di
                halaman mana pun dipisahkan oleh garis rambut saja. */}
            <div
              className={`absolute z-50 overflow-hidden rounded-card bg-surface shadow-float ring-1 ring-border ${panelPlacement}`}
            >
              {/* Alamat surel dibaca sebagai identitas, bukan kalimat — mono
                  membuatnya berhenti terlihat seperti teks badan. */}
              <p className="truncate border-b border-divider px-3 py-2 font-mono text-caption text-muted">
                {email}
              </p>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-body text-ink transition hover:bg-surface-sunken"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmOpen(true);
                }}
                className="block w-full border-t border-divider px-3 py-2 text-left text-body text-ink transition hover:bg-surface-sunken"
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Keluar dari akun?">
        <p className="text-body text-muted">
          Anda akan keluar dari akun Nerona di perangkat ini. Anda bisa masuk kembali kapan saja.
        </p>
        {/* Keluar bukan aksi yang menggerakkan uang, jadi bukan tombol emas —
            emas di dalam aplikasi hanya menandai top-up, pembayaran, dan
            perpanjangan. Ia juga bukan aksi merusak: akunnya tetap ada, jadi
            tingkatannya utama, bukan bahaya. */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={signingOut}>
            Batal
          </Button>
          <Button onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "Keluar..." : "Ya, keluar"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
