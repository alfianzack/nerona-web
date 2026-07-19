"use client";

import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";

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

  return (
    <AuthCard title="Atur ulang kata sandi" subtitle="Kami akan mengirim tautan lewat email.">
      {submitted ? (
        <p className="text-center text-sm text-navy-300">
          Jika email itu terdaftar, kami sudah mengirim tautan atur ulang — periksa kotak masuk Anda.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <AuthInput
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Mengirim..." : "Kirim tautan"}
          </AuthButton>
        </form>
      )}
    </AuthCard>
  );
}
