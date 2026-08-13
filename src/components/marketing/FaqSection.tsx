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
 * `className` dipertahankan karena pemanggil masih menitipkan kelas latar lewat
 * situ. Di lapisan token pemasaran `bg-canvas` dan `bg-surface` sama-sama putih:
 * pita dipisahkan oleh irama, bukan oleh rona.
 */
export function FaqSection({
  items,
  title = "Pertanyaan umum",
  className = "",
  id,
}: {
  items: FaqItem[];
  title?: string;
  className?: string;
  /** Anchor target, so the top nav can link to this section. */
  id?: string;
}) {
  return (
    <Band id={id} align="center" className={className}>
      <h2 className="text-balance text-display-2 text-ink">{title}</h2>

      <div className="mx-auto mt-12 max-w-2xl divide-y divide-divider border-y border-divider text-left">
        {items.map((item) => (
          <details key={item.question} className="group py-5">
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
    </Band>
  );
}
