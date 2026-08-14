"use client";

import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineLink } from "@/components/ui/InlineLink";
import { Icon } from "@/components/ui/icons";

export default function RequestResetPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <AuthShell title="Tautan terkirim">
        <div className="text-center">
          <Icon name="check-circle" className="mx-auto h-10 w-10 text-success" />
          {/* Kalimatnya sengaja tetap bersyarat. Memastikan "email Anda terdaftar"
              memberi tahu penebak alamat mana yang punya akun di sini. */}
          <p className="mt-4 text-body text-muted">
            Jika email itu terdaftar, kami sudah mengirim tautan atur ulang — periksa kotak
            masuk Anda.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Atur ulang kata sandi"
      subtitle="Kami akan mengirim tautan lewat email."
      footer={
        <>
          Ingat kata sandinya? <InlineLink href="/login">Masuk</InlineLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mb-5"
        />
        <Button type="submit" variant="primary" size="md" full disabled={submitting}>
          {submitting ? "Mengirim..." : "Kirim tautan"}
        </Button>
      </form>
    </AuthShell>
  );
}
