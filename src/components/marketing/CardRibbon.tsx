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
export function CardRibbon({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-chip bg-accent px-3 py-1 font-mono text-label font-semibold uppercase text-white">
      {children}
    </span>
  );
}
