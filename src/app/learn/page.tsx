import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function LearnCatalogPage() {
  const courses = await prisma.course.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="bg-navy-950">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Belajar
        </h1>
        <p className="mt-4 max-w-xl text-lg text-navy-300">
          Video tutorial dan kelas, dijual terpisah dari langganan Nerona.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/learn/${course.slug}`}
              className="group overflow-hidden rounded-3xl bg-gradient-to-b from-navy-800 to-navy-900 shadow-lg shadow-black/40 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-navy-900 to-navy-950 text-5xl transition duration-300 group-hover:scale-105">
                🎬
              </div>
              <div className="p-6">
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  {course.title}
                </h2>
                {course.description && (
                  <p className="mt-2 text-sm leading-relaxed text-navy-300">
                    {course.description}
                  </p>
                )}
                <p className="mt-4 text-sm font-semibold text-gold-400">
                  {course.priceLabel ?? "Hubungi kami"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
