"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthShell, AuthError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { InlineLink } from "@/components/ui/InlineLink";

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
    <AuthShell
      title="Masuk"
      subtitle="Kelola lisensi Nerona Anda."
      footer={
        <>
          Belum punya akun? <InlineLink href="/register">Daftar gratis</InlineLink>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {/* Galatnya menyangkut kombinasi email DAN kata sandi, jadi ia berdiri
            di atas formulir — bukan menempel di salah satu isian, yang akan
            menuduh isian yang belum tentu keliru. */}
        <AuthError message={error} />
        <Field
          id="email"
          name="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mb-4"
        />
        <Field
          id="password"
          name="password"
          label="Kata sandi"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mb-3"
        />
        <div className="mb-5 text-right text-caption">
          <InlineLink href="/reset-password">Lupa kata sandi?</InlineLink>
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
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
