"use client";

import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { TextLink } from "@/components/ui/TextLink";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Kata sandi tidak sama.");
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

  return (
    <AuthCard title="Buat akun" subtitle="Mulai kelola lisensi Nerona Anda.">
      {submitted ? (
        <p className="text-center text-body text-muted">
          Periksa kotak masuk Anda — kami mengirim tautan verifikasi untuk menyelesaikan pendaftaran.
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <AuthInput
              label="Nama"
              type="text"
              name="name"
              value={name}
              onChange={setName}
              autoComplete="name"
              required
            />
            <AuthInput
              label="Nomor HP"
              type="tel"
              name="phone"
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
              placeholder="08xxxxxxxxxx"
              required
            />
            <AuthInput
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <AuthInput
              label="Kata sandi"
              type="password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <AuthInput
              label="Ulangi kata sandi"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={error}
              autoComplete="new-password"
            />
            <AuthButton type="submit" disabled={submitting}>
              {submitting ? "Membuat akun..." : "Buat akun"}
            </AuthButton>
          </form>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-caption text-muted">atau</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton />
          <p className="mt-6 text-center text-body text-muted">
            Sudah punya akun? <TextLink href="/login">Masuk</TextLink>
          </p>
        </>
      )}
    </AuthCard>
  );
}
