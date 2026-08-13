"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

interface ProfileFormProps {
  initialName: string;
  initialPhone: string;
  initialBusinessName: string;
}

export function ProfileForm({ initialName, initialPhone, initialBusinessName }: ProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, businessName }),
      });
      setMessage(res.ok ? "Tersimpan." : "Gagal menyimpan.");
    } catch {
      setMessage("Gagal menyimpan. Periksa koneksi Anda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-title-2 text-ink">Informasi pelanggan</h2>
      {/*
        Field, bukan label plus input yang dijahit sendiri: ketiga label di sini
        sebelumnya tidak pernah tersambung ke isiannya, jadi mengkliknya tidak
        memindahkan fokus dan pembaca layar membacakan isian tanpa nama.
      */}
      <div className="mt-4 space-y-4">
        <Field
          id="profil-nama"
          label="Nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          id="profil-hp"
          label="Nomor HP"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Field
          id="profil-bisnis"
          label="Nama bisnis / toko"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
        {message && <span className="text-body text-muted">{message}</span>}
      </div>
    </Card>
  );
}
