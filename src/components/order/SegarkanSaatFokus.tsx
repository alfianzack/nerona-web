"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Memuat ulang data halaman order saat jendela ini kembali difokuskan.
 *
 * Alurnya menuntut ini: pelanggan membayar di tab halaman SumoPod, lalu
 * menutupnya dan kembali ke sini. Yang mengaktifkan paketnya webhook — jadi
 * pada detik ia kembali, halaman ini sudah basi dan masih berkata "menunggu
 * pembayaran" atas order yang sebenarnya sudah lunas. Tidak ada apa pun di
 * halaman yang akan membetulkan dirinya sendiri tanpa ini.
 *
 * Bukan polling berkala: tidak ada endpoint status untuk di-poll, dan mengulang
 * permintaan setiap beberapa detik untuk pengguna yang sedang tidak menatap
 * halaman ini hanya membebani server tanpa satu pun informasi baru. Fokus
 * kembali adalah tanda yang tepat — ia menandai "pengguna sudah selesai di
 * tempat lain".
 */
export function SegarkanSaatFokus() {
  const router = useRouter();
  const terakhir = useRef(0);

  useEffect(() => {
    function segarkan() {
      if (document.visibilityState === "hidden") return;
      // Jeda 3 detik: `focus` dan `visibilitychange` sering menembak berbarengan
      // untuk satu perpindahan tab, dan dua refresh berurutan cuma membuat
      // halaman berkedip.
      const sekarang = Date.now();
      if (sekarang - terakhir.current < 3000) return;
      terakhir.current = sekarang;
      router.refresh();
    }

    window.addEventListener("focus", segarkan);
    document.addEventListener("visibilitychange", segarkan);
    return () => {
      window.removeEventListener("focus", segarkan);
      document.removeEventListener("visibilitychange", segarkan);
    };
  }, [router]);

  return null;
}
