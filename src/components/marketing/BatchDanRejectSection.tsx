import { Band } from "@/components/ui/Band";
import { BatchProgressMockup } from "./mockups/BatchProgressMockup";
import { RejectAnalysisMockup } from "./mockups/RejectAnalysisMockup";

/**
 * Batas satu batch di ekstensi (BATCH_MAX_ITEMS di nerona_medata).
 *
 * Disalin, bukan diimpor: angkanya hidup di repo ekstensi. Salinan yang sama
 * ada di KeyNumbersSection — kalau batasnya berubah, keduanya ikut berubah.
 */
const BATCH_MAX_ITEMS = 50;

/**
 * Dua seksi jadi satu pita, satu kalimat masing-masing.
 *
 * Sebelumnya keduanya adalah `FeatureSection` penuh: judul, paragraf 30-an
 * kata, tiga bullet, dan mockup — padahal mockup di sebelahnya sudah
 * menunjukkan seluruh isi bulletnya. Menaruhnya berdampingan juga memperbaiki
 * ritme: dua pita dua-kolom berturut-turut dengan mockup di sisi yang
 * bergantian adalah pola yang paling sering diulang di halaman lama, dan
 * justru pengulangan itu yang membuatnya terasa panjang.
 *
 * Kolom kanan HILANG kalau tidak ada paket yang menawarkan reject analyzer.
 * Sebab yang sama seperti di seksi lamanya: menjanjikan fitur yang tidak bisa
 * dibeli siapa pun lebih mahal daripada kehilangan satu kolom. Syaratnya
 * DITURUNKAN dari baris Plan, tidak diketik — lihat lib/marketing-plans.ts.
 */
export function BatchDanRejectSection({
  id,
  reject,
}: {
  id?: string;
  reject: { plans: string[]; note: string | null };
}) {
  return (
    <Band id={id}>
      <div className="grid gap-14 md:grid-cols-2 md:gap-16">
        <div>
          <h2 className="text-balance text-display-2 text-ink">Dibuat untuk unggahan massal</h2>
          <p className="mt-4 text-body-lg text-muted">
            Sampai {BATCH_MAX_ITEMS} gambar sekali jalan, progres per gambar.
          </p>
          <div className="mt-8">
            <BatchProgressMockup />
          </div>
        </div>

        {reject.plans.length > 0 && (
          <div>
            <h2 className="text-balance text-display-2 text-ink">Ditolak? Cari tahu kenapa</h2>
            <p className="mt-4 text-body-lg text-muted">
              Tempel alasan penolakan, Nerona menunjuk perbaikannya.
            </p>
            {/* Syarat paketnya tetap ditulis, tidak disembunyikan — audit
                halaman menemukan versi lamanya menyebut satu paket sementara
                tabel harga di bawahnya mencentang ketiganya. */}
            {reject.note && (
              <p className="mt-2 font-mono text-label uppercase text-muted">{reject.note}</p>
            )}
            <div className="mt-8">
              <RejectAnalysisMockup />
            </div>
          </div>
        )}
      </div>
    </Band>
  );
}
