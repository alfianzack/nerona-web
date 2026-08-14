"use client";

import { useState, type FormEvent } from "react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineLink } from "@/components/ui/InlineLink";
import { Icon } from "@/components/ui/icons";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [mismatch, setMismatch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMismatch("");

    if (password !== confirmPassword) {
      // Galat yang memang milik satu isian tetap menempel di isian itu —
      // di sinilah kotak "Ulangi kata sandi" benar-benar yang keliru.
      setMismatch("Kata sandi tidak sama.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Terjadi kesalahan.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    // Lebarnya harus sama dengan formulir yang baru saja diisi: tanpa ini
    // kartunya menyempit satu langkah persis pada detik orang menekan
    // "Buat akun", dan halaman terlihat tersentak tanpa sebab.
    return (
      <AuthShell size="md" title="Cek email Anda">
        <div className="text-center">
          <Icon name="check-circle" className="mx-auto h-10 w-10 text-success" />
          <p className="mt-4 text-body text-muted">
            Kami mengirim tautan verifikasi ke{" "}
            <span className="font-medium text-ink">{email}</span>. Buka tautannya untuk
            menyelesaikan pendaftaran.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      size="md"
      title="Buat akun"
      subtitle="Paket Free aktif seketika, tanpa kartu kredit."
      footer={
        <>
          Sudah punya akun? <InlineLink href="/login">Masuk</InlineLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {/* Galat dari server — "Email sudah terdaftar" dan sejenisnya — berdiri
            di atas formulir. Sebelumnya ia ditempelkan ke isian TERAKHIR, jadi
            pesan tentang email muncul di bawah "Ulangi kata sandi" dan
            pengguna mengoreksi hal yang salah. */}
        <AuthError message={error} />

        {/* Nama dan nomor HP berdampingan di layar yang cukup lebar: formulir
            lima isian yang menumpuk lurus terbaca lebih panjang daripada
            sebenarnya, dan panjang formulir adalah alasan orang berhenti
            mendaftar. */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="name"
            name="name"
            label="Nama"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          <Field
            id="phone"
            name="phone"
            label="Nomor HP"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="08xxxxxxxxxx"
            required
          />
        </div>
        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mb-4"
        />
        <Field
          id="password"
          name="password"
          label="Kata sandi"
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
          label="Ulangi kata sandi"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={mismatch}
          autoComplete="new-password"
          required
          className="mb-5"
        />
        <Button type="submit" variant="primary" size="md" full disabled={submitting}>
          {submitting ? "Membuat akun..." : "Buat akun gratis"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-caption text-muted">atau</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </AuthShell>
  );
}
