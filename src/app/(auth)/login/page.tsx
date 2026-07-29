"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") ? "Terjadi kesalahan saat masuk." : ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Email atau kata sandi salah.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AuthCard title="Masuk" subtitle="Kelola lisensi Nerona Anda.">
      <form onSubmit={handleSubmit}>
        <AuthInput label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput
          label="Kata sandi"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          error={error}
          autoComplete="current-password"
        />
        <div className="mb-4 text-right">
          <a href="/reset-password" className="text-sm text-muted underline">
            Lupa kata sandi?
          </a>
        </div>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Sedang masuk..." : "Masuk"}
        </AuthButton>
      </form>
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-navy-900/5" />
        <span className="text-xs text-muted/70">atau</span>
        <div className="h-px flex-1 bg-navy-900/5" />
      </div>
      <GoogleButton />
      <p className="mt-6 text-center text-sm text-muted">
        Belum punya akun?{" "}
        <a href="/register" className="font-medium text-ink underline">
          Daftar sekarang
        </a>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
