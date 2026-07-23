"use client";

import { useState } from "react";

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
      <div className="mt-8 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
        <p className="font-medium text-ink">WhatsApp terhubung ✓</p>
        <p className="mt-1 text-sm text-muted">
          Nomor: {whatsappPhone}. Anda sekarang bisa chat langsung dengan Nerona Agent di{" "}
          {displayNumber}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-md">
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08123456789"
          className="flex-1 rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !phone}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Hubungkan"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

      {code && (
        <div className="mt-4 rounded-2xl bg-gradient-to-b from-surface to-surface2 p-5 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
          <p className="text-sm text-muted">
            Kirim kode berikut ke WhatsApp {displayNumber} untuk menyelesaikan tautan:
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-widest text-ink">
            {code}
          </p>
          {expires && (
            <p className="mt-1 text-xs text-muted">
              Berlaku sampai {new Date(expires).toLocaleTimeString("id-ID")}
            </p>
          )}
          <button
            onClick={handleRefreshStatus}
            className="mt-4 rounded-full bg-navy-900/5 px-3.5 py-1.5 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
          >
            Cek status
          </button>
        </div>
      )}
    </div>
  );
}
