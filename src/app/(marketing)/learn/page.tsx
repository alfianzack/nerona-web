import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

/**
 * Halaman ini dialihkan ke beranda selama katalognya belum dijual, jadi yang
 * dikerjakan di sini hanya pemindahan ke lapisan token — bukan rancang ulang.
 *
 * Kartunya dulu memakai resep lama yang sama dengan 40 berkas lain: gradien
 * putih menuju abu yang tidak mengerjakan apa pun, bayangan besar, dan cincin
 * navy tembus pandang sebagai garis. Ketiganya diselesaikan oleh Card. Sisa
 * hiasannya juga hilang: pratinjau kelas dulu sebuah emoji papan klaper 48px,
 * yang di ukuran itu terbaca seperti klip-seni.
 */
export default async function LearnCatalogPage() {
  const courses = await prisma.course.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main>
      <Band>
        <h1 className="text-balance text-display-1 text-ink">Belajar</h1>
        <p className="mt-5 max-w-[38ch] text-lead text-muted">
          Video tutorial dan kelas, dijual terpisah dari langganan Nerona.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {courses.map((course) => (
            /* Angkatan setengah piksel saat disentuh, sama seperti kartu produk
               di beranda — sejak bayangannya dilepas, itu satu-satunya isyarat
               bahwa kartunya bisa diklik. */
            <Link
              key={course.id}
              href={`/learn/${course.slug}`}
              className="block transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <Card padding="none" className="h-full overflow-hidden">
                <div className="flex h-40 items-center justify-center bg-surface-sunken text-muted">
                  <Icon name="play" className="h-8 w-8" />
                </div>
                <div className="p-6">
                  <h2 className="text-title-2 text-ink">{course.title}</h2>
                  {course.description && (
                    <p className="mt-2 text-body text-muted">{course.description}</p>
                  )}
                  <p className="mt-4 text-body font-semibold text-accent">
                    {course.priceLabel ?? "Hubungi kami"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Band>
    </main>
  );
}
