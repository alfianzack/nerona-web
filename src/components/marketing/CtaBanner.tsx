import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Ajakan penutup halaman.
 *
 * Gradien navy-nya bertahan — ini satu-satunya permukaan gelap yang tersisa di
 * halaman publik, dan justru karena tinggal satu, ia menandai sesuatu. Yang
 * dibuang dua blob kabur di belakangnya: keduanya hiasan, dan keduanya sebab
 * satu-satunya kartu ini butuh `overflow-hidden` beserta `relative` di setiap
 * anaknya.
 *
 * Tombolnya turun dari pil emas ke tombol putih. Emas hanya hidup di dalam
 * aplikasi, menandai aksi yang menggerakkan uang; di sini tidak ada aksi lain
 * untuk dibedakan, dan putih di atas navy sudah kontras paling tinggi yang bisa
 * diberikan halaman ini.
 *
 * Tanpa padding atas: ketiga pemanggilnya menaruh banner ini persis setelah
 * FaqSection, yang sudah menyumbang satu pita penuh (104px) di bawah isinya.
 */
export function CtaBanner({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <section className="px-6 pb-band">
      {/* Reveal dipasang di sini, bukan lewat prop `Band`: penutup ini bukan
          pita — ia kartu bergradien di dalam section-nya sendiri. Yang naik
          kartunya, dan itu memang yang benar: kartu yang naik utuh terbaca
          sebagai ajakan yang baru muncul, bukan sebagai latar yang bergeser. */}
      <Reveal className="mx-auto max-w-band">
        <div className="rounded-card bg-gradient-to-br from-navy-900 to-navy-700 px-8 py-16 text-center">
          <h2 className="text-balance text-display-2 text-white">{title}</h2>
          <p className="mx-auto mt-5 max-w-[42ch] text-balance text-lead text-navy-100">{body}</p>
          <ButtonLink href={ctaHref} variant="secondary" size="lg" className="mt-9">
            {ctaLabel}
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  );
}
