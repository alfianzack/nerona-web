"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

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
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-center text-title-1 text-ink">Atur ulang kata sandi</h1>
        <p className="mt-2 text-center text-body text-muted">
          Kami akan mengirim tautan lewat email.
        </p>
        <div className="mt-8">
          {submitted ? (
            <p className="text-center text-body text-muted">
              Jika email itu terdaftar, kami sudah mengirim tautan atur ulang — periksa kotak masuk Anda.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <Field
                id="email"
                name="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mb-4"
              />
              <Button type="submit" variant="primary" size="md" full disabled={submitting}>
                {submitting ? "Mengirim..." : "Kirim tautan"}
              </Button>
            </form>
          )}
        </div>
      </Card>
    </main>
  );
}
