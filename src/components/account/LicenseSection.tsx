"use client";

import { useState } from "react";

interface LicenseSectionProps {
  licenseKey: string;
  planName: string;
  status: string;
  validUntil: string | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: {
    label: "Aktif",
    className: "bg-emerald-400/10 text-emerald-400",
  },
  revoked: {
    label: "Dicabut",
    className: "bg-rose-400/10 text-rose-400",
  },
  comp: {
    label: "Gratis (comp)",
    className: "bg-gold-400/10 text-gold-300",
  },
  expired: {
    label: "Kedaluwarsa",
    className: "bg-white/10 text-navy-300",
  },
};

export function LicenseSection({ licenseKey, planName, status, validUntil }: LicenseSectionProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusBadge = STATUS_LABELS[status] ?? {
    label: status,
    className: "bg-white/10 text-navy-300",
  };

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 p-6 shadow-lg shadow-black/40 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <p className="font-semibold tracking-tight text-white">
          Lisensi {planName}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
      </div>
      <p className="mt-4 text-sm text-navy-300">Kunci lisensi</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="rounded-lg bg-white/5 px-2.5 py-1.5 text-sm text-white ring-1 ring-white/10">
          {licenseKey}
        </code>
        <button
          onClick={handleCopy}
          className="text-sm font-medium text-gold-400 hover:underline"
        >
          {copied ? "Tersalin!" : "Salin"}
        </button>
      </div>
      {validUntil && (
        <p className="mt-3 text-sm text-navy-300">
          Berlaku sampai: {validUntil}
        </p>
      )}
    </div>
  );
}
