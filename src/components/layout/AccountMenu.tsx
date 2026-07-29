"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";

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
          className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900/5 text-xs font-semibold text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
        >
          {initial}
        </button>

        {open && (
          <>
            {/* Click-away catcher — the dropdown is small enough not to need
                focus trapping, but it must not stay open behind a navigation. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl bg-surface shadow-lg shadow-navy-900/15 ring-1 ring-navy-900/10">
              <p className="truncate border-b border-navy-900/10 px-3 py-2 text-xs text-muted">
                {email}
              </p>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-ink transition hover:bg-navy-900/5"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmOpen(true);
                }}
                className="block w-full border-t border-navy-900/10 px-3 py-2 text-left text-sm text-ink transition hover:bg-navy-900/5"
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Keluar dari akun?">
        <p className="text-sm leading-relaxed text-muted">
          Anda akan keluar dari akun Nerona di perangkat ini. Anda bisa masuk kembali kapan saja.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            disabled={signingOut}
            className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
          >
            {signingOut ? "Keluar..." : "Ya, keluar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
