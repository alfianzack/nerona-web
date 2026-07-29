"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";

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
    <AuthCard title="Kata sandi baru">
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="Kata sandi baru"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <AuthInput
          label="Ulangi kata sandi baru"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={error}
          autoComplete="new-password"
        />
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan kata sandi"}
        </AuthButton>
      </form>
    </AuthCard>
  );
}
