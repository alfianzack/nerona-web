"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/icons";

interface AgentLinkPanelProps {
  displayNumber: string;
  whatsappPhone: string | null;
  phoneVerifiedAt: string | null;
}

export function AgentLinkPanel({
  displayNumber,
  whatsappPhone,
  phoneVerifiedAt,
}: AgentLinkPanelProps) {
  const [phone, setPhone] = useState(whatsappPhone ?? "");
  const [code, setCode] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState(phoneVerifiedAt);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/agent/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal membuat kode tautan.");
      return;
    }
    setCode(data.code);
    setExpires(data.expires);
    setVerifiedAt(null);
  }

  async function handleRefreshStatus() {
    const res = await fetch("/api/agent/status");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && data.profile) {
      setVerifiedAt(data.profile.phoneVerifiedAt);
    }
  }

  if (verifiedAt) {
    return (
      <Card className="mt-8">
        {/* Centangnya dulu glyph teks di ujung kalimat. Sebagai ikon ia bisa
            mengambil warna status dan tingginya sama di semua mesin. */}
        <p className="flex items-center gap-2 text-title-2 text-ink">
          <Icon name="check-circle" className="h-5 w-5 flex-none text-success" />
          WhatsApp terhubung
        </p>
        <p className="mt-1.5 text-body text-muted">
          Nomor: <span className="font-mono tabular-nums">{whatsappPhone}</span>. Anda sekarang
          bisa chat langsung dengan Nerona Agent di{" "}
          <span className="font-mono tabular-nums">{displayNumber}</span>.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-8 max-w-md">
      <div className="flex gap-2">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08123456789"
          className="flex-1 font-mono tabular-nums"
        />
        <Button onClick={handleSubmit} disabled={loading || !phone}>
          {loading ? "Memproses..." : "Hubungkan"}
        </Button>
      </div>
      {error && <p className="mt-2 text-caption text-danger">{error}</p>}

      {code && (
        <Card className="mt-4">
          <p className="text-body text-muted">
            Kirim kode berikut ke WhatsApp{" "}
            <span className="font-mono tabular-nums">{displayNumber}</span> untuk menyelesaikan
            tautan:
          </p>
          {/* Mono tanpa tambahan jarak huruf: lebar tiap karakter sudah sama,
              yang dulu jadi alasan kode ini direnggangkan tangan. */}
          <p className="mt-2 font-mono text-title-1 tabular-nums text-ink">{code}</p>
          {expires && (
            <p className="mt-1.5 text-caption text-muted">
              Berlaku sampai{" "}
              <span className="font-mono tabular-nums">
                {new Date(expires).toLocaleTimeString("id-ID")}
              </span>
            </p>
          )}
          <Button variant="secondary" size="sm" onClick={handleRefreshStatus} className="mt-4">
            Cek status
          </Button>
        </Card>
      )}
    </div>
  );
}
