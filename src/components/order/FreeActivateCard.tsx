"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

interface FreeActivateCardProps {
  product: "metadata" | "agent";
  planName: string;
}

export function FreeActivateCard({ product, planName }: FreeActivateCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleActivate() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, planName }),
    });
    const data = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal mengaktifkan. Coba lagi.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card padding="lg" className="text-center">
        {/* Sebelumnya emoji perayaan setinggi 30px. Pada ukuran itu emoji
            terbaca seperti klip seni, dan bentuknya berbeda di tiap sistem
            operasi; centang berwarna status mengabarkan hal yang sama. */}
        <Icon name="check-circle" className="mx-auto h-8 w-8 text-success" />
        <h2 className="mt-3 text-title-2 text-ink">Paket Free aktif!</h2>
        <p className="mt-2 text-body text-muted">
          {product === "metadata"
            ? "Lisensi Free Anda sudah dibuat — lihat kunci lisensi di halaman Akun."
            : "Nerona Agent Anda aktif — hubungkan nomor WhatsApp dari dashboard."}
        </p>
        <ButtonLink
          href={product === "metadata" ? "/account" : "/agent/dashboard"}
          className="mt-6"
        >
          {product === "metadata" ? "Buka Akun" : "Buka Dashboard Agent"}
        </ButtonLink>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="text-center">
      <h2 className="text-title-2 text-ink">Paket {planName}</h2>
      <p className="mt-2 text-body text-muted">Aktif seketika, tanpa pembayaran.</p>
      {error && <p className="mt-4 text-body text-danger">{error}</p>}
      <Button
        variant="money"
        size="lg"
        full
        className="mt-6"
        onClick={handleActivate}
        disabled={submitting}
      >
        {submitting ? "Memproses..." : "Aktifkan Gratis Sekarang"}
      </Button>
    </Card>
  );
}
