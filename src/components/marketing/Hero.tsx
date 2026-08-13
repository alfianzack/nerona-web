import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";
import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/ui/icons";
import { MetadataCardMockup } from "./mockups/MetadataCardMockup";

/**
 * Angka-angka di baris kepercayaan diambil dari registry dan default kode,
 * bukan ditulis tangan — supaya tidak bisa melenceng dari yang sebenarnya
 * diberikan. Kalau owner menimpa poin Free di Pengaturan, kalimat ini ikut
 * salah; itu tradeoff yang sama dengan halaman-halaman marketing lain.
 */
const HERO_FACTS = [
  `${CLAIMABLE_MARKETPLACES.length} marketplace didukung`,
  "Tanpa kartu kredit",
  `${DEFAULT_PLAN_POINTS.metadata.free} poin gratis untuk mencoba`,
];

/**
 * Hero, arah Bening.
 *
 * Empat hal yang dibuang, dan masing-masing punya sebab:
 *
 * 1. Gradien pada judul. Selain tidak pernah dipakai halaman yang jadi acuan,
 *    gradien lamanya memberi perhentian tengah dan akhir warna yang sama
 *    persis, jadi gradien tiga-perhentian itu sebenarnya hanya dua.
 *
 *    (Nama kelas sengaja tidak disebut di komentar mana pun setelah kelasnya
 *    dibuang: pemindai Tailwind ikut membaca komentar, jadi menyebutnya justru
 *    menghidupkan kembali kelas itu di bundel CSS.)
 * 2. Blob emas kabur 340px di belakang judul. Hiasan yang tidak menandai apa
 *    pun, dan satu-satunya alasan bagian ini butuh `overflow-hidden`.
 * 3. Pil kedua di sebelah pil pertama. Dua pil berdampingan membuat keduanya
 *    terlihat sama penting; aksi kedua turun jadi tautan teks supaya satu
 *    ajakan benar-benar terbaca sebagai satu ajakan.
 * 4. Centang emoji. Bentuk dan bobotnya berbeda di tiap sistem operasi dan
 *    tidak pernah mengikuti warna teks di sekitarnya.
 *
 * Yang naik: sub-judul dari text-lg/xl (18–20px) ke text-lead (18–26px).
 * Inilah sebab hero lama terasa kecil meski judulnya sudah 72px — bukan
 * judulnya yang kurang besar, tapi barisan di bawahnya yang tertinggal.
 */
export function Hero() {
  return (
    <Band align="center">
      <p className="text-body-lg font-semibold text-accent">Nerona Metadata</p>

      <h1 className="mx-auto mt-3 max-w-[15ch] text-balance text-display-1 text-ink">
        Metadata untuk kontributor stock, ditulis otomatis.
      </h1>

      <p className="mx-auto mt-5 max-w-[34ch] text-balance text-lead text-muted">
        Judul, deskripsi, dan kata kunci dibuat AI — lalu diisikan langsung ke formulir unggah
        marketplace Anda.
      </p>

      {/* Halaman jualan meminta pendaftaran lebih dulu; harga jadi pilihan
          kedua. Sebelumnya "Lihat Harga" adalah satu-satunya tombol, yang
          menggeser orang ke tabel harga sebelum mereka punya alasan. */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
        <ButtonLink href="/register" size="lg">
          Mulai gratis
        </ButtonLink>
        <TextLink href="#pricing" className="text-body-lg">
          Lihat harga
        </TextLink>
      </div>

      <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-caption text-muted">
        {HERO_FACTS.map((fact) => (
          <li key={fact} className="inline-flex items-center gap-2">
            <Icon name="check" className="h-3.5 w-3.5 flex-none text-accent" />
            {fact}
          </li>
        ))}
      </ul>

      {/* Satu-satunya animasi di halaman ini, dan letaknya di atas lipatan
          supaya benar-benar dilihat: kartu memainkan urutan pembuatannya
          sekali saat halaman dibuka. */}
      <div className="mx-auto mt-16 max-w-lg">
        <MetadataCardMockup animated />
      </div>
    </Band>
  );
}
