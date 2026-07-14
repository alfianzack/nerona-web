"use client";

import { signIn } from "next-auth/react";
import { AuthButton } from "./AuthButton";

export function GoogleButton() {
  return (
    <AuthButton variant="secondary" onClick={() => signIn("google", { callbackUrl: "/account" })}>
      Continue with Google
    </AuthButton>
  );
}
