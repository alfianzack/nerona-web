"use client";

import { useState, type FormEvent } from "react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
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
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-center text-title-1 text-ink">Buat akun</h1>
        <p className="mt-2 text-center text-body text-muted">
          Mulai kelola lisensi Nerona Anda.
        </p>
        <div className="mt-8">
          {submitted ? (
            <p className="text-center text-body text-muted">
              Periksa kotak masuk Anda — kami mengirim tautan verifikasi untuk menyelesaikan pendaftaran.
            </p>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <Field
                  id="name"
                  name="name"
                  label="Nama"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="mb-4"
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
                  className="mb-4"
                />
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
                  className="mb-4"
                />
                <Field
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Ulangi kata sandi"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={error}
                  autoComplete="new-password"
                  className="mb-4"
                />
                <Button type="submit" variant="primary" size="md" full disabled={submitting}>
                  {submitting ? "Membuat akun..." : "Buat akun"}
                </Button>
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
        </div>
      </Card>
    </main>
  );
}
