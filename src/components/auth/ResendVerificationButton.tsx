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
    return <p className="text-sm text-emerald-400">Email verifikasi terkirim — periksa kotak masuk Anda.</p>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "sending"}
      className="text-sm font-medium text-brand-blue underline disabled:opacity-50"
    >
      {status === "sending" ? "Mengirim..." : "Kirim ulang email verifikasi"}
    </button>
  );
}
