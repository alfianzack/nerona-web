"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function handleSignOut() {
    setSigningOut(true);
    signOut({ callbackUrl: "/" });
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu akun"
          aria-expanded={open}
          className="flex h-8 w-8 items-center justify-center rounded-full text-caption font-semibold text-ink ring-1 ring-border transition hover:bg-surface-sunken"
        >
          {initial}
        </button>

        {open && (
          <>
            {/* Click-away catcher — the dropdown is small enough not to need
                focus trapping, but it must not stay open behind a navigation. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            {/* Satu-satunya lapisan di kerangka aplikasi yang benar-benar
                melayang, jadi satu-satunya yang boleh berbayang. Kartu diam di
                halaman mana pun dipisahkan oleh garis rambut saja. */}
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-card bg-surface shadow-float ring-1 ring-border">
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
