import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasEnrollment } from "@/lib/course-access";
import { LessonPlayer } from "@/components/learn/LessonPlayer";

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
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {course.title}
        </h1>
        {course.description && (
          <p className="mt-4 text-lg text-muted">{course.description}</p>
        )}

        {!enrolled ? (
          <div className="mt-10 rounded-3xl bg-gradient-to-b from-surface to-surface2 p-8 text-center shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10">
            <p className="text-4xl font-semibold tracking-tight text-ink">
              {course.priceLabel ?? "Hubungi kami"}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              Hubungi kami untuk mendaftar — setelah pembayaran dikonfirmasi, kelas ini langsung
              terbuka di akun Anda.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {course.modules.map((mod) => (
              <div
                key={mod.id}
                className="rounded-3xl bg-gradient-to-b from-surface to-surface2 p-6 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900/10 sm:p-8"
              >
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {mod.title}
                </h2>
                <div className="mt-5 space-y-7">
                  {mod.lessons.map((lesson) => (
                    <div key={lesson.id}>
                      <p className="mb-2 text-sm font-medium text-muted">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
