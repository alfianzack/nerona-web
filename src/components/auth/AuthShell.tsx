import Link from "next/link";

/**
 * Kerangka bersama kelima layar auth.
 *
 * Sebelumnya tiap halaman menulis kerangkanya sendiri, dan tak satu pun punya
 * jalan pulang: grup (auth) sengaja tidak memasang header maupun footer, jadi
 * pengunjung yang mendarat di /login dari email atau dari hasil pencarian
 * terjebak di sana — tidak ada logo, tidak ada tautan, tidak ada cara melihat
 * produknya sebelum menyerahkan email. Logo di atas kartu memperbaiki itu
 * sekaligus memberi tahu situs siapa yang sedang meminta kata sandi mereka,
 * yang pada halaman masuk bukan soal sepele.
 *
 * Baris penutup pindah ke LUAR kartu. "Belum punya akun? Daftar" bukan bagian
 * dari formulir; menaruhnya di dalam membuat kartu berisi dua ajakan yang
 * bersaing, dan yang kalah selalu tombol utamanya.
 */
export function AuthShell({
  title,
  subtitle,
  footer,
  size = "sm",
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  /**
   * `md` untuk formulir yang menaruh dua isian berdampingan. Pada lebar `sm`
   * kedua kolomnya jadi terlalu sempit untuk menampung "08xxxxxxxxxx" tanpa
   * memotongnya.
   */
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-canvas px-4 py-16 lg:px-8">
      {/* Logo mengarah ke beranda, bukan sekadar gambar: inilah satu-satunya
          jalan keluar dari layar ini selain mengisi formulirnya.

          Ia menyingkir begitu panel merek muncul di sebelah kiri, karena panel
          itu membawa logonya sendiri — dua tanda merek di satu layar terbaca
          sebagai kelalaian. Hasilnya tetap satu logo di setiap lebar layar. */}
      <Link
        href="/"
        className="flex items-center gap-2 text-body-lg font-semibold tracking-tight text-ink transition hover:opacity-80 lg:hidden"
      >
        <img src="/logo-nerona.svg" alt="" className="h-6 w-6" />
        Nerona
      </Link>

      {/*
       * Kartunya ditulis tangan di sini alih-alih memakai komponen kartu, dan
       * itu satu-satunya alasannya: kartu ini harus BERHENTI jadi kartu di atas
       * 1024px. Di sana panel navy di kiri yang menyusun halaman, dan formulir
       * yang masih dikurung garis rambut di tengah kolom putih hanya
       * mengulanginya dengan lebih lemah.
       *
       * Tiap sifat kartu — sudut, latar, bantalan, cincin — dilingkupi varian
       * lebar-maksimum, bukan ditimpa di lebar besar. Bedanya bukan gaya: dua
       * utilitas yang menyetel properti sama pada satu elemen dimenangkan oleh
       * yang jatuh belakangan di CSS keluaran, bukan yang ditulis belakangan di
       * className, dan urutan itu menurut abjad. Dengan melingkupi semuanya,
       * tidak ada satu pun pasangan yang bersaing.
       */}
      <div
        className={`w-full max-lg:mt-8 max-lg:rounded-card max-lg:bg-surface max-lg:p-7 max-lg:ring-1 max-lg:ring-border ${
          size === "md" ? "max-w-md" : "max-w-sm"
        }`}
      >
        <h1 className="text-center text-title-1 text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-body text-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-body text-muted">{footer}</div>}
    </main>
  );
}

/**
 * Galat setingkat formulir, bukan setingkat isian.
 *
 * Sebelumnya galat dari server ditempelkan ke isian TERAKHIR tiap formulir.
 * Di halaman daftar itu berarti "Email sudah terdaftar" muncul di bawah
 * "Ulangi kata sandi" — isian yang sama sekali tidak bersalah, dan pengguna
 * mengoreksi hal yang salah. Galat yang menyangkut isian tertentu tetap
 * dioper ke Field-nya; yang datang dari server berdiri sendiri di sini.
 */
export function AuthError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 bg-danger-bg px-3.5 py-2.5 text-body text-danger ring-1 ring-danger/25"
    >
      {message}
    </p>
  );
}
