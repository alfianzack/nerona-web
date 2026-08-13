import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

export interface Step {
  title: string;
  body: string;
}

/**
 * Aksen tetap per langkah 1..3 (biru, jingga, emas).
 *
 * Sebelumnya tiga hex lepas dipasang lewat `style={{ backgroundColor }}`, dan
 * dua di antaranya membawa teks putih di atas warna merek mentah — #FF8B45
 * dengan putih hanya 2:1. Yang dipakai sekarang varian -ink dari lapisan
 * token: warna yang sama, cukup gelap untuk menahan angka putih di atasnya.
 */
const STEP_ACCENTS = ["bg-brand-blue-ink", "bg-brand-orange-ink", "bg-brand-gold-ink"];

export function StepsSection({
  title,
  subtitle,
  steps,
  variant = "plain",
  tone = "plain",
  className,
}: {
  title: string;
  subtitle?: string;
  steps: Step[];
  variant?: "plain" | "cards";
  /**
   * Nada pita, diteruskan ke Band.
   *
   * Sebelumnya latar diatur lewat className. Itu bekerja hanya karena kebetulan
   * urutan abjad: dua kelas latar pada satu elemen dimenangkan yang jatuh
   * belakangan di stylesheet, bukan yang ditulis belakangan. Mengandalkan itu
   * adalah persis jebakan yang didokumentasikan di Card.tsx, jadi kebutuhannya
   * dinaikkan jadi prop yang benar.
   */
  tone?: "plain" | "sunken" | "navy";
  className?: string;
}) {
  return (
    // className tetap diteruskan apa adanya supaya pemanggil masih bisa
    // memilih latar pitanya sendiri; Band menaruhnya paling belakang.
    <Band tone={tone} className={className}>
      <h2 className="text-balance text-center text-display-2 text-ink">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-5 max-w-2xl text-balance text-center text-lead text-muted">
          {subtitle}
        </p>
      )}
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {steps.map((step, i) => {
          const body = (
            <>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full font-mono text-caption font-semibold text-white",
                  STEP_ACCENTS[i % STEP_ACCENTS.length],
                  variant === "plain" && "mx-auto",
                )}
              >
                {i + 1}
              </span>
              <h3 className="mt-4 text-title-2 text-ink">{step.title}</h3>
              <p className="mt-1.5 text-body text-muted">{step.body}</p>
            </>
          );

          return variant === "cards" ? (
            <Card key={step.title} variant="sunken">
              {body}
            </Card>
          ) : (
            <div key={step.title} className="p-5 text-center">
              {body}
            </div>
          );
        })}
      </div>
    </Band>
  );
}
