import Link from "next/link";
import { formatRupiah } from "@/lib/plan-duration";
import { perPointLabel, topupLabel, type TopupPackage } from "@/lib/topup";

/**
 * Paket poin di halaman harga publik.
 *
 * Ada di sini karena sejak alur sekali bayar, poin adalah **satu-satunya yang
 * dibeli berulang**. Menyembunyikannya di `/finance` — halaman yang orang buka
 * untuk melihat tagihan, bukan untuk membeli — berarti mesin pendapatan yang
 * baru tidak pernah terlihat oleh calon pembeli.
 *
 * Tautannya ke `/finance`, bukan langsung membuat order: membeli poin menuntut
 * login dan paket aktif, dan tombol yang menjanjikan pembelian lalu berujung
 * halaman masuk lebih buruk daripada tautan yang jujur sejak awal.
 */
export function TopupSection({ packages }: { packages: TopupPackage[] }) {
  if (!packages.length) return null;

  // Paket termurah per poin ditandai. Tangga harganya sudah menurun, tapi
  // pembeli tidak menghitung itu sendiri di halaman harga.
  const termurah = packages.reduce((a, b) => (b.price / b.points < a.price / a.points ? b : a));

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-ink">
          Kehabisan poin? Isi ulang.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
          Paket di atas dibeli sekali dan aksesnya berlaku selamanya. Yang habis hanya poin —
          dan poin bisa diisi kapan saja, tanpa berlangganan.
        </p>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {packages.map((pkg) => {
            const hemat = pkg === termurah && packages.length > 1;
            return (
              <div
                key={pkg.points}
                className={`rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 text-center shadow-lg shadow-navy-900/10 ring-1 ${
                  hemat ? "ring-gold-400/50" : "ring-navy-900/10"
                }`}
              >
                {hemat && (
                  <span className="inline-block rounded-full bg-gold-400/20 px-3 py-0.5 text-[11px] font-bold text-gold-700">
                    Paling hemat
                  </span>
                )}
                <p className={`text-2xl font-extrabold text-ink ${hemat ? "mt-2" : ""}`}>
                  {topupLabel(pkg.points)}
                </p>
                <p className="mt-1 text-lg font-semibold text-brand-blue">
                  {formatRupiah(pkg.price)}
                </p>
                <p className="mt-1 text-xs text-muted">{perPointLabel(pkg)}</p>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">
          Poin terpakai setiap kali AI bekerja, dan yang belum terpakai tidak hangus. Isi ulang
          butuh paket yang aktif — poin tidak bisa dipakai sendirian.{" "}
          <Link href="/finance" className="font-semibold text-brand-blue hover:underline">
            Isi ulang di halaman Keuangan ›
          </Link>
        </p>
      </div>
    </section>
  );
}
