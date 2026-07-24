"use client";

import { useEffect, useState } from "react";

interface TokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ExtensionConnectPanel() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [created, setCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/extension/tokens");
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) setTokens(data.tokens);
  }
  useEffect(() => {
    load();
  }, []);

  async function createToken() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Extension" }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.ok) {
      setError("Gagal membuat token.");
      return;
    }
    setCreated(data.token);
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" });
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <h2 className="text-lg font-semibold text-ink">Hubungkan Extension</h2>
      <p className="mt-1 text-sm text-muted">
        Buat token lalu tempel di extension Nerona Metadata untuk menghubungkan akun ini.
      </p>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      {created && (
        <div className="mt-4 rounded-2xl bg-gold-400/15 p-4 ring-1 ring-gold-400/40">
          <p className="text-xs font-semibold text-ink">Token baru (salin sekarang — tidak ditampilkan lagi):</p>
          <code className="mt-1 block break-all text-sm text-ink">{created}</code>
        </div>
      )}

      <button
        onClick={createToken}
        disabled={loading}
        className="mt-4 rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Membuat..." : "Buat token"}
      </button>

      <ul className="mt-4 divide-y divide-navy-900/10">
        {tokens.length === 0 && <li className="py-2 text-sm text-muted">Belum ada token.</li>}
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-ink">{t.label || "Token"}</p>
              <p className="text-xs text-muted">
                Dibuat {new Date(t.createdAt).toLocaleDateString("id-ID")}
                {t.lastUsedAt ? ` · dipakai ${new Date(t.lastUsedAt).toLocaleDateString("id-ID")}` : " · belum dipakai"}
              </p>
            </div>
            <button
              onClick={() => revoke(t.id)}
              className="rounded-full bg-navy-900/5 px-3 py-1 text-xs font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10"
            >
              Cabut
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
