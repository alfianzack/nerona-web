import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_ADMIN_EMAIL;
  if (!ownerEmail) {
    throw new Error("Set OWNER_ADMIN_EMAIL in .env.local before running the seed script.");
  }

  const user = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail },
  });

  await prisma.adminRole.upsert({
    where: { userId: user.id },
    update: { role: "owner_admin" },
    create: { userId: user.id, role: "owner_admin" },
  });

  console.log(`Granted owner_admin to ${ownerEmail}`);

  await seedPlans();
  await seedCourses();
}

type SeedPlan = {
  name: string;
  priceLabel: string;
  marketplaces: string;
  rejectAnalyzer: boolean;
  generationLimit: number | null;
};

// Three tiers gated by three levers: which marketplaces a License covers,
// monthly AI generations (display-only for now), and the reject analyzer.
// priceLabel values are placeholders — prices are managed from /admin, and the
// seed never overwrites an existing plan's priceLabel.
const PLANS: SeedPlan[] = [
  {
    name: "Free",
    priceLabel: "Rp 0",
    marketplaces: "adobe",
    rejectAnalyzer: false,
    generationLimit: 50,
  },
  {
    name: "Pro",
    priceLabel: "Rp 99.000/bulan",
    marketplaces: "*",
    rejectAnalyzer: false,
    generationLimit: 500,
  },
  {
    name: "Business",
    priceLabel: "Rp 199.000/bulan",
    marketplaces: "*",
    rejectAnalyzer: true,
    generationLimit: null,
  },
];

async function seedPlans() {
  for (const planData of PLANS) {
    const { priceLabel, ...structural } = planData;
    const existing = await prisma.plan.findFirst({ where: { name: planData.name } });
    if (existing) {
      await prisma.plan.update({ where: { id: existing.id }, data: structural });
    } else {
      await prisma.plan.create({ data: planData });
    }
    console.log(`Seeded plan "${planData.name}"`);
  }

  // Retire plans that are no longer offered (e.g. the old "Starter" tier),
  // but never delete one that a granted license still points at.
  const retired = await prisma.plan.deleteMany({
    where: { name: { notIn: PLANS.map((plan) => plan.name) }, licenses: { none: {} } },
  });
  if (retired.count > 0) {
    console.log(`Retired ${retired.count} unused plan(s)`);
  }
}

// Videos are shared assets: the "class" course's modules reuse the same
// recordings as the "tutorial" course, organized differently. Replace the
// placeholder vimeoId values below with real Vimeo video IDs before launch.
type SeedLesson = { videoTitle: string; vimeoId: string; title?: string };
type SeedModule = { title: string; lessons: SeedLesson[] };
type SeedCourse = {
  slug: string;
  title: string;
  description: string;
  priceLabel: string;
  modules: SeedModule[];
};

// priceLabel values are placeholders — prices are managed from /admin, and the
// seed never overwrites an existing course's priceLabel.
const COURSES: SeedCourse[] = [
  {
    slug: "tutorial",
    title: "Tutorial Nerona",
    description:
      "Kumpulan video tutorial mandiri yang membahas alur kerja inti — tonton kapan saja.",
    priceLabel: "Rp 99.000",
    modules: [
      {
        title: "Video Tutorial",
        lessons: [
          { videoTitle: "Memulai", vimeoId: "000000001" },
          { videoTitle: "Alur kerja inti", vimeoId: "000000002" },
          { videoTitle: "Kesalahan yang sering terjadi", vimeoId: "000000003" },
        ],
      },
    ],
  },
  {
    slug: "class",
    title: "Kelas Nerona",
    description:
      "Kelas terstruktur dengan pelacakan progres — mencakup semua video tutorial plus materi lanjutan.",
    priceLabel: "Rp 249.000",
    modules: [
      {
        title: "Modul 1: Dasar",
        lessons: [
          { videoTitle: "Memulai", vimeoId: "000000001" },
          { videoTitle: "Alur kerja inti", vimeoId: "000000002" },
          { videoTitle: "Kesalahan yang sering terjadi", vimeoId: "000000003" },
        ],
      },
      {
        title: "Modul 2: Lanjutan",
        lessons: [
          { videoTitle: "Teknik lanjutan 1", vimeoId: "000000004" },
          { videoTitle: "Teknik lanjutan 2", vimeoId: "000000005" },
          { videoTitle: "Penutup", vimeoId: "000000006" },
        ],
      },
    ],
  },
];

async function upsertVideo(videoTitle: string, vimeoId: string) {
  const existing = await prisma.video.findFirst({ where: { title: videoTitle } });
  if (existing) {
    return prisma.video.update({ where: { id: existing.id }, data: { vimeoId } });
  }
  return prisma.video.create({ data: { title: videoTitle, vimeoId } });
}

async function upsertModule(courseId: string, title: string, order: number) {
  const existing = await prisma.module.findFirst({ where: { courseId, title } });
  if (existing) {
    return prisma.module.update({ where: { id: existing.id }, data: { order } });
  }
  return prisma.module.create({ data: { courseId, title, order } });
}

async function upsertLesson(moduleId: string, videoId: string, order: number, title?: string) {
  const existing = await prisma.lesson.findFirst({ where: { moduleId, order } });
  if (existing) {
    return prisma.lesson.update({ where: { id: existing.id }, data: { videoId, title } });
  }
  return prisma.lesson.create({ data: { moduleId, videoId, order, title } });
}

async function seedCourses() {
  for (const courseData of COURSES) {
    const course = await prisma.course.upsert({
      where: { slug: courseData.slug },
      update: {
        title: courseData.title,
        description: courseData.description,
      },
      create: {
        slug: courseData.slug,
        title: courseData.title,
        description: courseData.description,
        priceLabel: courseData.priceLabel,
      },
    });

    for (const [moduleIndex, moduleData] of courseData.modules.entries()) {
      const mod = await upsertModule(course.id, moduleData.title, moduleIndex);

      for (const [lessonIndex, lessonData] of moduleData.lessons.entries()) {
        const video = await upsertVideo(lessonData.videoTitle, lessonData.vimeoId);
        await upsertLesson(mod.id, video.id, lessonIndex, lessonData.title);
      }
    }

    console.log(`Seeded course "${course.slug}"`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
