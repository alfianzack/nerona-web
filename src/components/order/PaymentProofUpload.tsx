"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
            className="max-h-64 rounded-xl ring-1 ring-navy-900/10"
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
            className="max-h-64 rounded-xl ring-1 ring-navy-900/10"
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
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-full bg-navy-900/5 px-4 py-2 text-sm font-medium text-ink ring-1 ring-navy-900/10 transition hover:bg-navy-900/10 disabled:opacity-50"
      >
        {uploading ? "Mengunggah..." : showImage ? "Ganti bukti transfer" : "Unggah bukti transfer"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      <p className="mt-2 text-xs text-muted/80">Format PNG, JPG, atau WEBP. Maksimal 5 MB.</p>
    </div>
  );
}
