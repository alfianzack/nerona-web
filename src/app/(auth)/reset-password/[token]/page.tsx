"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function ConfirmResetPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [mismatch, setMismatch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMismatch("");

    if (password !== confirmPassword) {
      // Milik isian ini sungguhan, jadi ditempelkan di isian ini.
      setMismatch("Kata sandi tidak sama.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Galat dari server di sini biasanya soal TAUTANNYA — kedaluwarsa atau
      // sudah dipakai — bukan soal kata sandi yang baru diketik. Menempelkannya
      // ke kotak kata sandi membuat orang mengetik ulang sesuatu yang tidak
      // pernah salah.
      setError(data.message || "Terjadi kesalahan.");
      setSubmitting(false);
      return;
    }

    router.push("/login");
  }

  return (
    <AuthShell title="Kata sandi baru" subtitle="Pilih kata sandi untuk akun Anda.">
      <form onSubmit={handleSubmit}>
        <AuthError message={error} />
        <Field
          id="password"
          name="password"
          label="Kata sandi baru"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="mb-4"
        />
        <Field
          id="confirmPassword"
          name="confirmPassword"
          label="Ulangi kata sandi baru"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={mismatch}
          autoComplete="new-password"
          required
          className="mb-5"
        />
        <Button type="submit" variant="primary" size="md" full disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan kata sandi"}
        </Button>
      </form>
    </AuthShell>
  );
}
