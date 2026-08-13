import { Band } from "@/components/ui/Band";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

interface FeatureSectionProps {
  title: string;
  body: string;
  mockup: React.ReactNode;
  theme: "light" | "dark" | "navy";
  imageSide: "left" | "right";
  bullets?: string[];
  /** Anchor target, so the top nav can link to a section. */
  id?: string;
}

/**
 * Nama tema di sini lebih tua dari lapisan token dan tidak bisa diganti tanpa
 * menyentuh berkas pemanggil: "dark" duduk di kanvas halaman, "light" adalah
 * permukaan yang sedikit terangkat, sehingga bagian-bagian berselang-seling
 * menuruni halaman. "navy" satu-satunya pita yang benar-benar gelap.
 *
 * Pemetaan ke tone Band ditulis sebagai tabel supaya nama lama itu berhenti
 * membingungkan di badan komponen.
 */
const BAND_TONE = {
  dark: "plain",
  light: "sunken",
  navy: "navy",
} as const;

export function FeatureSection({
  title,
  body,
  mockup,
  theme,
  imageSide,
  bullets,
  id,
}: FeatureSectionProps) {
  // Di pita navy warnanya dibalik tangan: token ink/muted tetap warna terang
  // karena permukaan gelap belum punya set tokennya sendiri.
  const navy = theme === "navy";

  return (
    <Band id={id} tone={BAND_TONE[theme]}>
      <div
        className={cn(
          "flex flex-col items-center gap-14 md:flex-row md:gap-20",
          imageSide === "left" && "md:flex-row-reverse",
        )}
      >
        <div className="flex-1">
          <h2 className={cn("text-balance text-display-2", navy ? "text-white" : "text-ink")}>
            {title}
          </h2>
          <p className={cn("mt-5 text-body-lg", navy ? "text-navy-100" : "text-muted")}>{body}</p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-7 space-y-3">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className={cn(
                    "flex items-start gap-2.5 text-body",
                    navy ? "text-navy-100" : "text-ink",
                  )}
                >
                  {/* Centangnya dulu emoji ✓ di dalam lingkaran berwarna:
                      bentuknya beda di tiap sistem operasi dan lingkarannya
                      tidak menandai apa pun. */}
                  <Icon
                    name="check"
                    className={cn(
                      "mt-[3px] h-4 w-4 flex-none",
                      navy ? "text-brand-sky" : "text-accent",
                    )}
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="w-full flex-1">{mockup}</div>
      </div>
    </Band>
  );
}
