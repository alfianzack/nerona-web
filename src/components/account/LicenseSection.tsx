"use client";

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface LicenseSectionProps {
  licenseKey: string;
  planName: string;
  status: string;
  validUntil: string | null;
}

/**
 * Nada, bukan pasangan warna tertulis.
 *
 * Keempat status ini sebelumnya memegang hex-nya sendiri, dan langkah warnanya
 * tidak cocok dengan status di layar mana pun yang lain — "Aktif" hijau 400 di
 * sini, hijau 600 di halaman order. Nadanya sekarang dipilih di satu tempat.
 *
 * "Gratis (comp)" turun ke nada info, bukan emas: emas di dalam aplikasi
 * menandai uang yang bergerak dan saldo poin, dan lisensi komplimen justru
 * kebalikannya.
 */
const STATUS_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Aktif", tone: "success" },
  revoked: { label: "Dicabut", tone: "danger" },
  comp: { label: "Gratis (comp)", tone: "info" },
  expired: { label: "Kedaluwarsa", tone: "neutral" },
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
    tone: "neutral" as BadgeTone,
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-title-2 text-ink">Lisensi {planName}</h2>
        <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
      </div>

      <p className="mt-5 font-mono text-label uppercase text-muted">Kunci lisensi</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {/*
          Seleksi seluruh kunci dalam satu klik. Tombol Salin di sebelahnya butuh
          izin papan klip yang tidak selalu ada — mis. halaman dibuka lewat
          http di jaringan lokal — dan tanpa itu menyeret kunci sepanjang ini
          tanpa terpotong bukan pekerjaan yang menyenangkan.
        */}
        <code className="select-all rounded-chip bg-surface-sunken px-2.5 py-1.5 font-mono text-body tabular-nums text-ink ring-1 ring-border">
          {licenseKey}
        </code>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? "Tersalin!" : "Salin"}
        </Button>
      </div>

      {validUntil && (
        <p className="mt-4 text-body text-muted">
          Berlaku sampai:{" "}
          <span className="font-mono tabular-nums text-ink">{validUntil}</span>
        </p>
      )}
    </Card>
  );
}
