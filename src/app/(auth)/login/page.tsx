"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthButton } from "@/components/auth/AuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { TextLink } from "@/components/ui/TextLink";

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

    // /post-login decides the destination for both sign-in paths: the
    // callbackUrl if there is a safe one, otherwise the role's home.
    const callbackUrl = searchParams.get("callbackUrl");
    router.push(
      callbackUrl ? `/post-login?next=${encodeURIComponent(callbackUrl)}` : "/post-login"
    );
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
        {/* Tautan sekunder memakai TextLink, bukan garis bawah abu-abu: satu-satunya
            aksi yang boleh terlihat sebagai tombol di kartu ini adalah "Masuk". */}
        <div className="mb-4 text-right text-caption">
          <TextLink href="/reset-password">Lupa kata sandi?</TextLink>
        </div>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Sedang masuk..." : "Masuk"}
        </AuthButton>
      </form>
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-caption text-muted">atau</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton callbackUrl={searchParams.get("callbackUrl")} />
      <p className="mt-6 text-center text-body text-muted">
        Belum punya akun? <TextLink href="/register">Daftar sekarang</TextLink>
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
