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
    <AuthCard title="Reset password" subtitle="We'll email you a reset link.">
      {submitted ? (
        <p className="text-center text-sm text-gray-500">
          If that email exists, we&apos;ve sent a reset link — check your inbox.
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
            {submitting ? "Sending..." : "Send reset link"}
          </AuthButton>
        </form>
      )}
    </AuthCard>
  );
}
