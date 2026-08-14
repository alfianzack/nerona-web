import { Band } from "@/components/ui/Band";
import { Icon } from "@/components/ui/icons";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Pertanyaan umum, arah Bening.
 *
 * Setiap pertanyaan dulu sebuah kartu tersendiri: latar cekung, cincin, sudut
 * 16px, dan jarak antar kartu. Sepuluh kartu bertumpuk membuat halaman terlihat
 * seperti daftar panel, bukan daftar pertanyaan. Sekarang satu daftar yang
 * dipisah garis rambut — permukaannya tidak berubah saat dibuka, yang berubah
 * hanya arah chevron-nya.
 *
 * Dua perubahan berikutnya datang dari jumlah: daftarnya naik dari lima ke
 * sepuluh pertanyaan, dan pada sepuluh, bentuk lamanya rubuh dua kali.
 *
 * 1. Judul di atas + daftar sempit di tengah membuat bagian ini satu pilar
 *    tinggi yang harus digulir sampai habis sebelum ada apa pun lain terlihat.
 *    Judulnya sekarang pindah ke samping dan ikut menggulir bersama daftarnya
 *    di layar lebar. Ini juga menambah bentuk bagian KETIGA ke beranda, yang
 *    selama ini cuma punya dua: dua-kolom bolak-balik, dan tumpukan rata
 *    tengah.
 * 2. Sepuluh panel yang bisa terbuka semua sekaligus adalah dinding teks
 *    sepanjang tiga layar. Atribut `name` yang sama pada tiap elemen details
 *    membuat peramban menutup yang lain begitu satu dibuka — perilaku bawaan
 *    peramban, tanpa satu baris JavaScript pun. Peramban lama yang belum
 *    mengenalnya cuma kembali ke perilaku sekarang: boleh terbuka bersamaan.
 *
 * `className` dipertahankan karena pemanggil masih menitipkan kelas latar lewat
 * situ. Di lapisan token pemasaran, latar kanvas dan latar permukaan sama-sama
 * putih: pita dipisahkan oleh irama, bukan oleh rona. Hanya latar cekung yang
 * benar-benar berbeda rona, dan itulah yang dipakai berselang-seling.
 *
 * Nama kelasnya sengaja tidak ditulis di komentar ini — pemindai Tailwind
 * membaca komentar sebagai teks biasa, jadi menyebut kelas di sini bisa
 * menerbitkan aturan CSS yang tidak dipakai siapa pun.
 */
export function FaqSection({
  items,
  title = "Pertanyaan umum",
  className = "",
  tone,
  id,
}: {
  items: FaqItem[];
  title?: string;
  className?: string;
  /**
   * Dioper ke pita, bukan ditimpa lewat className: latar pita adalah properti
   * yang sama dengan latar yang akan ditumpangkan, dan pemenangnya ditentukan
   * urutan abjad di CSS keluaran.
   */
  tone?: "plain" | "sunken";
  /** Anchor target, so the top nav can link to this section. */
  id?: string;
}) {
  // Nama grup akordeon. Diturunkan dari `id` supaya dua FaqSection di satu
  // halaman tidak saling menutup jawaban.
  const group = id ? `faq-${id}` : "faq";

  return (
    <Band id={id} tone={tone} className={className}>
      <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-x-16">
        {/* Menempel saat digulir, dengan jarak aman dari bilah atas setinggi
            56px yang juga menempel. */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-balance text-display-2 text-ink">{title}</h2>
        </div>

        {/* Perataan kiri tidak lagi perlu dibatalkan di sini: pita ini tidak
            lagi memakai perataan tengah. */}
        <div className="mt-10 divide-y divide-divider border-y border-divider lg:mt-0">
          {items.map((item) => (
            <details key={item.question} name={group} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-body-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {item.question}
                {/* Dulu glyph teks + dan – : tingginya berbeda antar huruf dan
                    tidak bisa disetel ukurannya. */}
                <Icon
                  name="chevron-down"
                  className="h-4 w-4 flex-none text-muted group-open:hidden"
                />
                <Icon
                  name="chevron-up"
                  className="hidden h-4 w-4 flex-none text-accent group-open:block"
                />
              </summary>
              <p className="mt-3 max-w-[68ch] text-body-lg text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Band>
  );
}
