"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

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
    <Card>
      <h2 className="text-title-2 text-ink">Ganti password</h2>
      {/*
        Kata-katanya sama persis dengan placeholder yang dulu dipakai, hanya
        pindah jadi label. Placeholder lenyap begitu orang mulai mengetik —
        di formulir dua isian yang keduanya bertitik-titik, itu justru
        menghapus satu-satunya penanda mana yang lama dan mana yang baru.
      */}
      <div className="mt-4 space-y-4">
        <Field
          id="password-lama"
          label="Password lama"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Field
          id="password-baru"
          label="Password baru (min. 8 karakter)"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !currentPassword || !newPassword}>
          {saving ? "Menyimpan..." : "Ubah password"}
        </Button>
        {message && (
          <span className={`text-body ${ok ? "text-success" : "text-danger"}`}>{message}</span>
        )}
      </div>
    </Card>
  );
}
