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
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        <p className="font-medium text-gray-900 dark:text-white">WhatsApp terhubung ✓</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
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
          className="flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm ring-0 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-white/10 dark:focus:bg-gray-900 text-gray-950 dark:text-white"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !phone}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Hubungkan"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {code && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Kirim kode berikut ke WhatsApp {displayNumber} untuk menyelesaikan tautan:
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-widest text-gray-950 dark:text-white">
            {code}
          </p>
          {expires && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Berlaku sampai {new Date(expires).toLocaleTimeString("id-ID")}
            </p>
          )}
          <button
            onClick={handleRefreshStatus}
            className="mt-4 rounded-full bg-gray-100 px-3.5 py-1.5 text-sm font-medium text-gray-950 transition hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            Cek status
          </button>
        </div>
      )}
    </div>
  );
}
