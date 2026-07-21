"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-xl bg-navy-900/5 px-3 py-2 text-sm text-ink ring-1 ring-navy-900/10 placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setOk(true);
        setMessage("Password berhasil diubah.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setOk(false);
        setMessage(data?.message || "Gagal mengubah password.");
      }
    } catch {
      setOk(false);
      setMessage("Gagal mengubah password. Periksa koneksi Anda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
      <p className="text-sm font-semibold text-ink">Ganti password</p>
      <div className="mt-3 space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Password lama"
          className={inputClass}
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Password baru (min. 8 karakter)"
          className={inputClass}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !currentPassword || !newPassword}
          className="rounded-full bg-gradient-to-br from-gold-500 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Ubah password"}
        </button>
        {message && (
          <span className={`text-sm ${ok ? "text-emerald-600" : "text-rose-500"}`}>{message}</span>
        )}
      </div>
    </div>
  );
}
