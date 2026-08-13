"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface PaymentProofUploadProps {
  orderId: string;
  hasProof: boolean;
  disabled?: boolean;
}

export function PaymentProofUpload({ orderId, hasProof, disabled }: PaymentProofUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // Cache-busting key so the <img> reloads after a successful upload.
  const [version, setVersion] = useState(0);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    const body = new FormData();
    body.append("proof", file);
    const res = await fetch(`/api/orders/${orderId}/proof`, { method: "POST", body });
    const data = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok || !data?.ok) {
      setError(data?.message || "Gagal mengunggah bukti.");
      return;
    }
    setVersion((v) => v + 1);
    router.refresh();
  }

  const showImage = hasProof || version > 0;

  if (disabled) {
    return (
      <div>
        {showImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/orders/${orderId}/proof?v=${version}`}
            alt="Bukti pembayaran"
            className="max-h-64 rounded-card ring-1 ring-border"
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {showImage && (
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/orders/${orderId}/proof?v=${version}`}
            alt="Bukti pembayaran"
            className="max-h-64 rounded-card ring-1 ring-border"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? "Mengunggah..." : showImage ? "Ganti bukti transfer" : "Unggah bukti transfer"}
      </Button>
      {error && <p className="mt-2 text-body text-danger">{error}</p>}
      <p className="mt-2 text-caption text-muted">Format PNG, JPG, atau WEBP. Maksimal 5 MB.</p>
    </div>
  );
}
