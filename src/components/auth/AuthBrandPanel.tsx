import Link from "next/link";
import { CLAIMABLE_MARKETPLACES } from "@/lib/marketplaces";
import { MetadataCardMockup } from "@/components/marketing/mockups/MetadataCardMockup";
import { Icon } from "@/components/ui/icons";

/**
 * Kolom kiri layar auth.
 *
 * Sebabnya: kelima layar auth adalah kartu putih di atas kanvas putih. Permukaan
 * Bening menyetel kanvas dan permukaan ke nilai yang sama persis, bayangan kartu
 * ke nihil, dan sudut ke nol — di halaman pemasaran yang panjang itu ketenangan,
 * tapi satu kartu kecil di tengah viewport kosong membacanya sebagai halaman
 * yang belum jadi. Panel ini yang menyusun halamannya, bukan kartunya.
 *
 * Ia tinggal di tata letak grup (auth), bukan di AuthShell, dan itu bukan
 * pilihan gaya:
 *
 * 1. Empat dari lima halaman auth adalah komponen klien, jadi AuthShell ikut
 *    masuk graf klien di rute-rute itu dan tidak akan pernah bisa menunggu
 *    angka poin yang sesungguhnya. Tata letaknya server.
 * 2. Tata letak Next.js tidak dilepas saat pindah rute, jadi /login → /register
 *    tidak memasang ulang panel ini.
 * 3. Formulir /login berada di dalam Suspense (ia membaca parameter pencarian).
 *    Panel di dalam halaman akan berkedip hilang pada cat pertama; di tata letak
 *    tidak pernah.
 *
 * Kartu contoh dipakai apa adanya. Ia berdiri di atas permukaan putihnya
 * sendiri, jadi di atas navy ia terbaca sebagai kartu terang yang melayang —
 * yang memang efek yang dicari. Menjadikannya gelap berarti menyunting komponen
 * yang juga dirender tiga bagian pemasaran, dan tidak ada yang didapat.
 */
export function AuthBrandPanel({ freePoints }: { freePoints: number }) {
  // Angkanya diselesaikan pemanggil lewat rantai DB → env → default. Membaca
  // konstanta kode di sini pernah jadi bug sungguhan di hero: begitu owner
  // menimpanya di Pengaturan, halamannya berbohong tanpa ada yang memberi tahu.
  const facts = [
    `${CLAIMABLE_MARKETPLACES.length} marketplace didukung`,
    "Tanpa kartu kredit",
    `${freePoints} poin gratis untuk mencoba`,
  ];

  // Panel ini sengaja TIDAK dipatok setinggi layar.
  //
  // Versi pertamanya dipatok — melekat, setinggi viewport, dan menggulir
  // sendiri kalau isinya tidak muat. Isinya butuh sekitar 765px, jadi di setiap
  // layar yang lebih pendek dari itu (laptop 1280x620, jendela yang tidak
  // dimaksimalkan) baris fakta di bawah terpotong ke dalam penggulung milik
  // panel sendiri — hilang dari pandangan, dan tidak ada yang menandai bahwa ia
  // ada. Terbukti dengan mengukur scrollHeight lawan clientHeight di peramban,
  // bukan diduga.
  //
  // Dibiarkan meregang, panel mengikuti tinggi baris: minimal setinggi layar
  // karena induknya menyetel itu, dan lebih tinggi bila isinya menuntut,
  // sehingga halamanlah yang menggulir dan tidak ada yang tersembunyi.
  return (
    <aside className="hidden bg-gradient-to-br from-navy-900 to-navy-700 px-10 py-12 lg:flex lg:w-1/2 lg:flex-col xl:px-14">
      {/*
       * Ketiga baris berbagi satu kolom, dan kolom itulah yang dipusatkan —
       * bukan tiap barisnya sendiri-sendiri. Tanpa pembatas ini panel selebar
       * 720px di layar 1440 memberi kartu contoh ruang yang tidak dipakainya,
       * dan sisa navy di kanan kartu terbaca sebagai kelalaian tata letak,
       * bukan sebagai ruang kosong yang disengaja. Lebarnya mengikuti habitat
       * asli kartu itu di hero.
       */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between">
        {/* Satu-satunya elemen yang bisa difokus di panel ini, jadi satu-satunya
            yang butuh jejak fokusnya sendiri: aturan global menggambar garis
            fokus dengan warna aksen, dan aksen di atas navy nyaris tak
            terlihat. */}
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-body-lg font-semibold tracking-tight text-white transition hover:opacity-80 focus-visible:outline-white"
        >
          <img src="/logo-nerona.svg" alt="" className="h-6 w-6" />
          Nerona
        </Link>

        <div className="py-10">
          {/* Paragraf, bukan judul. Judul satu-satunya di layar ini milik
              formulir di kolom kanan, dan panel ini mendahuluinya di DOM —
              menaikkannya jadi judul membuat orang yang menyusuri halaman lewat
              daftar judul bertemu tingkat dua sebelum tingkat satu, untuk
              kalimat yang bukan judul bagian apa pun. */}
          <p className="max-w-[17ch] text-balance text-title-1 text-white">
            Metadata untuk kontributor stock, ditulis otomatis.
          </p>

          <div className="mt-9">
            <MetadataCardMockup animated />
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 text-body text-navy-100">
          {facts.map((fact) => (
            <li key={fact} className="flex items-center gap-2.5">
              <Icon name="check" className="h-3.5 w-3.5 flex-none text-brand-sky" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
