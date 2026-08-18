import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";
import { CardRibbon } from "@/components/marketing/CardRibbon";
import { TextLink } from "@/components/ui/TextLink";
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
    <Band align="center">
      <h2 className="text-balance text-display-2 text-ink">Kehabisan poin? Isi ulang.</h2>
      <p className="mx-auto mt-5 max-w-[46ch] text-balance text-lead text-muted">
        Paket di atas dibeli sekali dan aksesnya berlaku selamanya. Yang habis hanya poin —
        dan poin bisa diisi kapan saja, tanpa berlangganan.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {packages.map((pkg) => {
          const hemat = pkg === termurah && packages.length > 1;
          // Ditandai cincin dan pita aksen — perlakuan yang sama persis dengan
          // kartu unggulan di PricingTierGrid, sampai ke komponen pitanya.
          //
          // Pitanya mengambang di tepi atas, bukan duduk di dalam kartu:
          // sebelumnya lencananya ikut aliran dan mendorong isi kartunya turun,
          // jadi satu-satunya kartu bertanda justru satu-satunya kartu yang
          // angkanya tidak sebaris dengan dua tetangganya.
          return (
            <Card
              key={pkg.points}
              variant={hemat ? "accent" : "default"}
              padding="lg"
              className="relative text-center"
            >
              {hemat && <CardRibbon>Paling hemat</CardRibbon>}
              <p className="text-title-1 tabular-nums text-ink">{topupLabel(pkg.points)}</p>
              <p className="mt-1.5 font-mono text-body-lg font-semibold tabular-nums text-accent">
                {formatRupiah(pkg.price)}
              </p>
              <p className="mt-1.5 text-caption text-muted">{perPointLabel(pkg)}</p>
            </Card>
          );
        })}
      </div>

      {/* Tanda › tidak ditulis di kalimatnya lagi — TextLink yang memasangnya,
          dan dua kali berarti dua tanda. */}
      <p className="mx-auto mt-8 max-w-[64ch] text-caption text-muted">
        Poin terpakai setiap kali AI bekerja, dan yang belum terpakai tidak hangus. Isi ulang
        butuh paket yang aktif — poin tidak bisa dipakai sendirian.{" "}
        <TextLink href="/finance" className="font-semibold">
          Isi ulang di halaman Keuangan
        </TextLink>
      </p>
    </Band>
  );
}
