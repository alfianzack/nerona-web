import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasEnrollment } from "@/lib/course-access";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { Band } from "@/components/ui/Band";
import { Card } from "@/components/ui/Card";

/**
 * Sama seperti katalognya: halaman ini belum terjangkau, jadi yang dikerjakan
 * hanya pemindahan ke lapisan token. Panel harga dan tiap modul memakai resep
 * kartu lama yang sama — gradien yang tidak mengerjakan apa pun, bayangan, dan
 * cincin navy tembus pandang sebagai garis — dan keduanya diselesaikan Card.
 */
export default async function CoursePage({ params }: { params: { slug: string } }) {
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { video: true } } },
      },
    },
  });
  if (!course) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const enrolled = session?.user?.id ? await hasEnrollment(session.user.id, course.id) : false;

  let completedLessonIds = new Set<string>();
  if (enrolled && session?.user?.id) {
    const progress = await prisma.lessonProgress.findMany({
      where: { userId: session.user.id, lesson: { module: { courseId: course.id } } },
      select: { lessonId: true },
    });
    completedLessonIds = new Set(progress.map((p) => p.lessonId));
  }

  return (
    <main>
      <Band>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-balance text-display-2 text-ink">{course.title}</h1>
          {course.description && (
            <p className="mt-5 text-lead text-muted">{course.description}</p>
          )}

          {!enrolled ? (
            <Card padding="lg" className="mt-10 text-center">
              <p className="text-title-1 tabular-nums text-ink">
                {course.priceLabel ?? "Hubungi kami"}
              </p>
              <p className="mx-auto mt-3 max-w-md text-body text-muted">
                Hubungi kami untuk mendaftar — setelah pembayaran dikonfirmasi, kelas ini langsung
                terbuka di akun Anda.
              </p>
            </Card>
          ) : (
            <div className="mt-10 space-y-8">
              {course.modules.map((mod) => (
                <Card key={mod.id} padding="lg">
                  <h2 className="text-title-2 text-ink">{mod.title}</h2>
                  <div className="mt-5 space-y-7">
                    {mod.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <p className="mb-2 text-body font-medium text-muted">
                          {lesson.title ?? lesson.video.title}
                        </p>
                        <LessonPlayer
                          lessonId={lesson.id}
                          vimeoId={lesson.video.vimeoId}
                          initiallyCompleted={completedLessonIds.has(lesson.id)}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Band>
    </main>
  );
}
