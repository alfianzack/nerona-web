"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";

/**
 * Empat path berwarna resmi Google. Warnanya tidak boleh ikut token mana pun —
 * pedoman merek Google mengunci keempat hex ini, jadi logo ini satu-satunya
 * tempat di layar auth yang memakai warna di luar palet Nerona.
 */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.38-2.29v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export function GoogleButton({ callbackUrl }: { callbackUrl?: string | null }) {
  // Land on /post-login rather than a hardcoded /dashboard, so admins reach
  // /admin and a deep link survives the OAuth round trip.
  const next = callbackUrl
    ? `/post-login?next=${encodeURIComponent(callbackUrl)}`
    : "/post-login";

  // Tingkat kedua, bukan tombol utama: kartu masuk sudah punya satu aksi utama,
  // dan dua tombol dengan bobot sama membuat keduanya berhenti menonjol.
  // Bingkainya diambil langsung dari Button — pembungkus span lama tidak lagi
  // diperlukan karena Button sendiri sudah inline-flex dengan jarak antar anak.
  return (
    <Button
      variant="secondary"
      full
      onClick={() => signIn("google", { callbackUrl: next })}
    >
      <GoogleLogo />
      Lanjutkan dengan Google
    </Button>
  );
}
