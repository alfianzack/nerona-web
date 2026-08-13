"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal to <body>: ancestors with backdrop-filter/transform (e.g. the
  // sticky blurred header) would otherwise become the containing block for
  // this fixed overlay and clip it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Tirai memakai tinta, bukan navy — nilainya sengaja disamakan dengan
          tirai laci di AppShell supaya dua lapisan melayang di aplikasi yang
          sama tidak menggelapkan latar dengan kadar yang berbeda. */}
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      {/* Satu dari dua tempat yang masih pantas berbayang: dialog memang
          melayang di atas halaman. Kartu diam tidak. */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-6 shadow-float ring-1 ring-border">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-title-2 text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="flex-none rounded-control p-1.5 text-muted transition hover:bg-surface-sunken hover:text-ink"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
