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
      setError("Passwords do not match.");
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
      setError(data.message || "Something went wrong.");
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <AuthCard title="Create account" subtitle="Start managing your Nerona license.">
      {submitted ? (
        <p className="text-center text-sm text-gray-500">
          Check your inbox for a verification link to finish setting up your account.
        </p>
      ) : (
        <>
          <GoogleButton />
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            <span className="text-xs text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
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
              label="Password"
              type="password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <AuthInput
              label="Confirm password"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={error}
              autoComplete="new-password"
            />
            <AuthButton type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </AuthButton>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/login" className="font-medium text-gray-900 underline dark:text-white">
              Sign in
            </a>
          </p>
        </>
      )}
    </AuthCard>
  );
}
