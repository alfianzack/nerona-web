import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";

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
 * PITA PENUH, bukan kartu membulat di dalam pita putih.
 *
 * Sebelumnya penutup ini kartu bergradien yang mengambang di atas latar putih,
 * jadi halaman berakhir dengan pita putih — dan bersama pita harga serta pita
 * batch di atasnya, itu membuat separuh bawah halaman terbaca sebagai deretan
 * putih yang sama. Mockup navy-amber menutup halaman dengan navy yang mengisi
 * lebar penuh, dan itu memang yang benar: warna gelap di ujung memberi halaman
 * dasar, bukan sekadar satu kartu lagi.
 *
 * `reveal` lewat prop Band sekarang, bukan <Reveal> sendiri: yang naik isinya,
 * dan latar navy-nya diam. Latar sebesar ini yang ikut memudar terbaca sebagai
 * halaman yang berkedip, bukan sebagai ajakan yang muncul.
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
    <Band tone="navy-gradient" align="center" reveal>
      <h2 className="text-balance text-display-2 text-white">{title}</h2>
      <p className="mx-auto mt-5 max-w-[42ch] text-balance text-lead text-navy-100">{body}</p>
      <ButtonLink href={ctaHref} variant="secondary" size="lg" className="mt-9">
        {ctaLabel}
      </ButtonLink>
    </Band>
  );
}
