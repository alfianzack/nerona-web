"use client";

import { useState } from "react";

export function ResendVerificationButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleClick() {
    setStatus("sending");
    await fetch("/api/resend-verification", { method: "POST" });
    setStatus("sent");
  }

  if (status === "sent") {
    return <p className="text-sm text-green-600">Verification email sent — check your inbox.</p>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "sending"}
      className="text-sm font-medium text-gray-900 underline disabled:opacity-50 dark:text-white"
    >
      {status === "sending" ? "Sending..." : "Resend verification email"}
    </button>
  );
}
