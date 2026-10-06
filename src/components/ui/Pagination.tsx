import { PAGE_SIZE, pageCount } from "@/lib/pagination";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { Icon } from "./icons";

/**
 * Kaki paginasi bersama untuk semua tabel dan daftar baris.
 *
 * Dua cara pakai, dipilih dari prop yang diisi:
 * - `hrefFor`: halaman server. Tiap tombol adalah tautan `?hal=`, jadi halaman
 *   yang sedang dibuka bisa dibagikan dan tombol Kembali browser bekerja.
 *   `scroll={false}` karena sebagian daftar ada di bawah layar; melompat ke
 *   atas setiap ganti halaman membuat orang kehilangan tempatnya.
 * - `onPageChange`: panel klien yang memuat datanya sendiri lewat fetch.
 *
 * Tombolnya hanya muncul kalau halamannya lebih dari satu. Daftar kosong tidak
 * dapat kaki sama sekali: keadaan kosongnya sudah dikatakan daftar itu sendiri.
 *
 * Di bawah `sm` tombolnya ikon saja, 44x44 (target sentuh), dengan teks
 * "Sebelumnya"/"Berikutnya" tetap ada untuk pembaca layar. Dengan teks penuh,
 * dua tombol plus "Hal 2 / 3" butuh ±316px sementara kartu di layar 375px
 * cuma menyisakan 287px, dan labelnya patah jadi dua baris (terukur
 * 2026-09-28). Mulai `sm` kembali ke tombol kecil bertuliskan, supaya kakinya
 * tidak lebih tebal dari baris tabel.
 */
export function Pagination(props: {
  page: number;
  total: number;
  pageSize?: number;
  /** Kata benda untuk hitungan, mis. "pengguna". Kosong = hanya angka. */
  noun?: string;
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  /** Mengunci tombol selama halaman berikutnya dimuat. */
  busy?: boolean;
  className?: string;
}) {
  const { page, total, pageSize = PAGE_SIZE, noun, hrefFor, onPageChange, busy, className } = props;
  if (total === 0) return null;

  const totalPages = pageCount(total, pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  // `relative` menjadi blok acuan label sr-only di dalam tombol, supaya label
  // itu tidak lolos dari wadah bergulir mana pun di atasnya.
  const tap = "relative min-h-11 min-w-11 sm:min-h-0 sm:min-w-0";

  function control(target: number, enabled: boolean, label: string, icon: "prev" | "next") {
    const content = (
      <>
        {icon === "prev" && <Icon name="arrow-left" className="h-4 w-4 flex-none" />}
        <span className="sr-only sm:not-sr-only">{label}</span>
        {icon === "next" && <Icon name="chevron-right" className="h-4 w-4 flex-none" />}
      </>
    );
    if (hrefFor && enabled) {
      return (
        <ButtonLink href={hrefFor(target)} scroll={false} variant="secondary" size="sm" className={tap}>
          {content}
        </ButtonLink>
      );
    }
    return (
      <Button
        variant="secondary"
        size="sm"
        className={tap}
        disabled={!enabled || busy}
        onClick={onPageChange ? () => onPageChange(target) : undefined}
      >
        {content}
      </Button>
    );
  }

  return (
    <nav
      aria-label="Halaman"
      className={`flex flex-wrap items-center justify-between gap-3 text-caption text-muted ${className ?? ""}`}
    >
      <span>
        Menampilkan{" "}
        <span className="font-mono tabular-nums text-ink">
          {from}–{to}
        </span>{" "}
        dari <span className="font-mono tabular-nums text-ink">{total.toLocaleString("id-ID")}</span>
        {noun ? ` ${noun}` : ""}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {control(page - 1, page > 1, "Sebelumnya", "prev")}
          <span className="whitespace-nowrap font-mono tabular-nums text-muted">
            Hal {page} / {totalPages}
          </span>
          {control(page + 1, page < totalPages, "Berikutnya", "next")}
        </div>
      )}
    </nav>
  );
}
