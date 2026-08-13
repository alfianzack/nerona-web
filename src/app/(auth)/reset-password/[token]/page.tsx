"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

export default function ConfirmResetPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Kata sandi tidak sama.");
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
      setError(data.message || "Terjadi kesalahan.");
      setSubmitting(false);
      return;
    }

    router.push("/login");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-center text-title-1 text-ink">Kata sandi baru</h1>
        <div className="mt-8">
          <form onSubmit={handleSubmit}>
            <Field
              id="password"
              name="password"
              label="Kata sandi baru"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mb-4"
            />
            <Field
              id="confirmPassword"
              name="confirmPassword"
              label="Ulangi kata sandi baru"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error}
              autoComplete="new-password"
              className="mb-4"
            />
            <Button type="submit" variant="primary" size="md" full disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan kata sandi"}
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
