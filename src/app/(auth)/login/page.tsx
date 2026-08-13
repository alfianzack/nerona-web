"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
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
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-center text-title-1 text-ink">Masuk</h1>
        <p className="mt-2 text-center text-body text-muted">Kelola lisensi Nerona Anda.</p>
        <div className="mt-8">
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
            <Field
              id="password"
              name="password"
              label="Kata sandi"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
              autoComplete="current-password"
              className="mb-4"
            />
            {/* Tautan sekunder memakai TextLink, bukan garis bawah abu-abu: satu-satunya
                aksi yang boleh terlihat sebagai tombol di kartu ini adalah "Masuk". */}
            <div className="mb-4 text-right text-caption">
              <TextLink href="/reset-password">Lupa kata sandi?</TextLink>
            </div>
            <Button type="submit" variant="primary" size="md" full disabled={submitting}>
              {submitting ? "Sedang masuk..." : "Masuk"}
            </Button>
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
        </div>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
