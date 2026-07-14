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
    searchParams.get("error") ? "Something went wrong signing in." : ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }

    router.push("/account");
  }

  return (
    <AuthCard title="Sign in" subtitle="Manage your Nerona license.">
      <GoogleButton />
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      </div>
      <form onSubmit={handleSubmit}>
        <AuthInput label="Email" type="email" name="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={setPassword}
          error={error}
          autoComplete="current-password"
        />
        <div className="mb-4 text-right">
          <a href="/reset-password" className="text-sm text-gray-500 underline">
            Forgot password?
          </a>
        </div>
        <AuthButton type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </AuthButton>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <a href="/register" className="font-medium text-gray-900 underline dark:text-white">
          Create one
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
