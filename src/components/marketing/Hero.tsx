import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { DEFAULT_PLAN_POINTS } from "@/lib/plan-points";
import { Band } from "@/components/ui/Band";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TextLink } from "@/components/ui/TextLink";
import { Icon } from "@/components/ui/icons";
import { MetadataCardMockup } from "./mockups/MetadataCardMockup";

/**
 * Angka-angka di baris kepercayaan diambil dari registry dan dari paket yang
 * benar-benar berlaku, bukan ditulis tangan.
 *
 * Poin Free dulu dibaca dari default KODE, dan itu bug: nilai yang berlaku
 * diselesaikan lewat rantai DB → env → default, jadi begitu owner menimpanya di
 * Pengaturan, hero ini berbohong tanpa ada yang memberi tahu. Docblock lamanya
 * menyebut alternatifnya "satu query DB di halaman yang selain ini tidak butuh
 * apa pun" — itu tidak lagi benar. Beranda sudah memanggil metadataTiers(), dan
 * pemanggilan itu sudah menyelesaikan nilai yang benar untuk paket Free. Ia
 * cukup dioper ke sini, tanpa satu pun query tambahan.
 */
function heroFacts(freePoints: number) {
  return [
    `${CLAIMABLE_MARKETPLACES.length} marketplace didukung`,
    "Tanpa kartu kredit",
    `${freePoints} poin gratis untuk mencoba`,
  ];
}

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
 * Yang naik: sub-judul dari 18–20px ke skala lead, 18–26px. Inilah sebab hero
 * lama terasa kecil meski judulnya sudah 72px — bukan judulnya yang kurang
 * besar, tapi barisan di bawahnya yang tertinggal.
 *
 * Latarnya sekarang navy bergradien, bukan putih.
 *
 * Sebabnya sama dengan sebab panel auth dibuat: pita ini 1155px penuh putih di
 * bawah bilah yang juga putih, dan tidak ada satu pun yang menandai di mana
 * halaman dimulai. Warna merek tidak muncul sampai layar kedelapan.
 *
 * Setiap warna di dalamnya dibalik dengan tangan, karena permukaan gelap belum
 * punya set tokennya sendiri: token ink, muted, dan accent semuanya dipilih
 * untuk berdiri di atas putih, dan ketiganya nyaris hilang di atas navy —
 * accent paling parah, sekitar 1,5:1. Kartu contoh justru tidak disentuh: ia
 * berdiri di atas permukaan putihnya sendiri, jadi di atas navy ia terbaca
 * sebagai kartu terang yang melayang, sama seperti di panel auth.
 *
 * Susunannya terbelah dua kolom mulai dari lg: teks di kiri, kartu contoh di
 * kanan.
 *
 * Sebelumnya satu kolom rata tengah, dan bentuk itu memaksa tiga hal yang
 * masing-masing dikeluhkan terpisah padahal sebabnya satu. Kolom tunggal
 * menuntut setiap unsur menumpuk ke bawah, jadi kartu contoh — satu-satunya
 * bukti produk di layar pertama, dan satu-satunya animasi di halaman ini —
 * terdorong sekitar delapan ratus piksel ke bawah dan berhenti berada di atas
 * lipatan yang komentar di bawah sana klaim. Tumpukan itu juga yang membuat
 * pitanya jangkung, dan pita jangkung berisi satu kolom sempit meninggalkan
 * bidang gelap luas yang kosong di kiri-kanannya — yang justru membuat
 * gradiennya terbaca rata. Membelahnya menyelesaikan ketiganya sekaligus:
 * kartu naik sejajar teks, tingginya turun, dan cahaya di latar akhirnya punya
 * benda untuk disinari.
 *
 * Yang TIDAK ikut turun: ukuran judul. Judul tetap display-1, dan dialah yang
 * sekarang memegang hampir seluruh tinggi pita — empat baris pada 80px. Itu
 * memang membuat pemangkasan tingginya sedang saja, bukan drastis. Menurunkan
 * skalanya ke display-2 akan memangkas jauh lebih banyak, tapi display-2 sudah
 * dipakai judul-judul bagian di bawah, jadi judul hero akan berhenti terdengar
 * paling besar di halamannya sendiri. Memendekkan kalimatnya adalah keputusan
 * naskah, bukan keputusan tata letak.
 *
 * Batas ukur pindah dari unsur ke kolom. Judul dan sub-judul dulu memakai
 * max-w-[15ch] dan max-w-[34ch] berpasangan dengan mx-auto, sebab di kolom
 * rata tengah selebar pita tidak ada yang lain yang membatasi panjang barisnya.
 * Kolom kiri sekarang mengerjakan itu sendiri, dan mempertahankan keduanya
 * berarti memotong ukur dua kali dengan angka yang tidak lagi ada hubungannya
 * dengan lebar yang sebenarnya berlaku.
 */
export function Hero({ freePoints = DEFAULT_PLAN_POINTS.metadata.free }: { freePoints?: number }) {
  // Default-nya tetap konstanta kode supaya pemanggil yang belum mengoper nilai
  // sungguhan tidak menampilkan kosong — tapi beranda WAJIB mengopernya.
  const facts = heroFacts(freePoints);

  return (
    <Band tone="navy-gradient">
      {/* Kartu jauh lebih pendek dari kolom teks, jadi items-center — rata atas
          akan menggantungnya di sepertiga atas dengan ruang kosong menganga di
          bawahnya. Kolom kanan dipatok minmax(0,380px), bukan pecahan: kartu
          ini punya lebar terbaca sendiri, dan membiarkannya melar mengikuti
          pita hanya membuat chip kata kuncinya berbaris terlalu renggang. */}
      <div className="grid items-center gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div>
          <p className="text-body-lg font-semibold text-brand-sky">Nerona Metadata</p>

          <h1 className="mt-3 text-balance text-display-1 text-white">
            Metadata untuk kontributor stock, ditulis otomatis.
          </h1>

          <p className="mt-5 max-w-[42ch] text-pretty text-lead text-navy-100">
            Judul, deskripsi, dan kata kunci dibuat AI — lalu diisikan langsung ke formulir unggah
            marketplace Anda.
          </p>

          {/* Halaman jualan meminta pendaftaran lebih dulu; harga jadi pilihan
              kedua. Sebelumnya "Lihat Harga" adalah satu-satunya tombol, yang
              menggeser orang ke tabel harga sebelum mereka punya alasan. */}
          {/* Tombolnya turun dari pil biru ke pil putih, sebab yang sama dengan
              banner penutup: pil biru membaca token aksi permukaan pemasaran, dan
              biru itu dipilih untuk berdiri di atas putih. Di atas navy ia kehilangan
              hampir seluruh kontrasnya. Putih di atas navy adalah kontras tertinggi
              yang bisa diberikan halaman ini. */}
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <ButtonLink href="/register" variant="secondary" size="lg">
              Mulai gratis
            </ButtonLink>
            <TextLink href="#pricing" tone="on-navy" className="text-body-lg">
              Lihat harga
            </TextLink>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-caption text-navy-100">
            {facts.map((fact) => (
              <li key={fact} className="inline-flex items-center gap-2">
                <Icon name="check" className="h-3.5 w-3.5 flex-none text-brand-sky" />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        {/* Satu-satunya animasi di halaman ini, dan sekarang benar-benar di atas
            lipatan: kartu memainkan urutan pembuatannya sekali saat halaman
            dibuka. Di bawah lg ia turun ke bawah teks — tetap rata kiri, bukan
            mx-auto, supaya kolom tunggal di ponsel punya satu tepi kiri saja. */}
        <div className="w-full max-w-lg lg:max-w-none lg:justify-self-end">
          <MetadataCardMockup animated />
        </div>
      </div>
    </Band>
  );
}
