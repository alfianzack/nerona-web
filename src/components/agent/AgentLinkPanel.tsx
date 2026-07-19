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
      <div className="mt-8 rounded-2xl bg-gradient-to-b from-navy-800 to-navy-900 p-6 shadow-lg shadow-black/40 ring-1 ring-white/10">
        <p className="font-medium text-white">WhatsApp terhubung ✓</p>
        <p className="mt-1 text-sm text-navy-300">
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
          className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-navy-300/60 focus:outline-none focus:ring-2 focus:ring-gold-400"
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
        <div className="mt-4 rounded-2xl bg-gradient-to-b from-navy-800 to-navy-900 p-5 shadow-lg shadow-black/40 ring-1 ring-white/10">
          <p className="text-sm text-navy-300">
            Kirim kode berikut ke WhatsApp {displayNumber} untuk menyelesaikan tautan:
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-widest text-white">
            {code}
          </p>
          {expires && (
            <p className="mt-1 text-xs text-navy-300">
              Berlaku sampai {new Date(expires).toLocaleTimeString("id-ID")}
            </p>
          )}
          <button
            onClick={handleRefreshStatus}
            className="mt-4 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20"
          >
            Cek status
          </button>
        </div>
      )}
    </div>
  );
}
