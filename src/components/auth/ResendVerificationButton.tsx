"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ResendVerificationButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleClick() {
    setStatus("sending");
    await fetch("/api/resend-verification", { method: "POST" });
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <p className="text-body text-success">
        Email verifikasi terkirim — periksa kotak masuk Anda.
      </p>
    );
  }

  // Tautan kecil di dalam kotak pemberitahuan, jadi varian ghost — bukan tombol
  // penuh, yang akan bersaing dengan aksi utama halaman ini.
  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={status === "sending"}>
      {status === "sending" ? "Mengirim..." : "Kirim ulang email verifikasi"}
    </Button>
  );
}
