/**
 * Pita penanda di tepi atas kartu — "Paling populer" di paket, "Paling hemat"
 * di paket poin.
 *
 * Ada sebagai komponen karena kedua tempat itu memang harus terlihat sama, dan
 * sebelumnya tidak: paket memakai pita mengambang, paket poin memakai Badge
 * biasa DI DALAM kartu. Badge di dalam kartu mendorong seluruh isinya turun,
 * jadi satu-satunya kartu yang ditandai justru satu-satunya kartu yang angkanya
 * tidak sebaris dengan yang lain — persis kebalikan dari maksud penandaan.
 *
 * Posisinya absolut, jadi kartu pemanggil wajib `relative`.
 */
export function CardRibbon({
  children,
  /**
   * `amber` untuk kartu paket unggulan di halaman jualan, `accent` (bawaan)
   * untuk sisanya.
   *
   * Amber lembut dengan teks gelap, BUKAN amber pekat dengan teks putih:
   * putih di atas #F2A93B hanya sekitar 2:1 dan gagal di ukuran label yang
   * kecil ini — sebab yang sama yang membuat `--on-action` gelap.
   */
  nada = "accent",
}: {
  children: React.ReactNode;
  nada?: "accent" | "amber";
}) {
  return (
    <span
      className={
        "absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-chip px-3 py-1 font-mono text-label font-semibold uppercase " +
        (nada === "amber" ? "bg-action-soft text-on-action-soft" : "bg-accent text-white")
      }
    >
      {children}
    </span>
  );
}
