"use client";

import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function RegisterPage() {
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
      body: JSON.stringify({ email, password }),
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
        <p className="text-center text-sm text-navy-300">
          Periksa kotak masuk Anda — kami mengirim tautan verifikasi untuk menyelesaikan pendaftaran.
        </p>
      ) : (
        <>
          <GoogleButton />
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-navy-300/70">atau</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <form onSubmit={handleSubmit}>
            <AuthInput
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
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
          <p className="mt-6 text-center text-sm text-navy-300">
            Sudah punya akun?{" "}
            <a href="/login" className="font-medium text-white underline">
              Masuk
            </a>
          </p>
        </>
      )}
    </AuthCard>
  );
}
