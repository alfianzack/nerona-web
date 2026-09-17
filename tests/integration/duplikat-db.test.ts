import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Uji integrasi penjaga duplikat terhadap Postgres sungguhan.
 *
 * Tes unit di `tests/lib/extension-duplikat.test.ts` membuktikan rumus jaraknya
 * dengan baris palsu. Yang TIDAK bisa dibuktikan di sana adalah querynya:
 * apakah `imageHash: { not: null }` menyaring dengan benar, apakah urutannya
 * memang dari yang terbaru, dan apakah pencarian benar-benar terkurung pada
 * satu kontributor. Kebocoran lingkup di situ berarti menunjukkan judul kiriman
 * orang lain kepada kontributor yang salah, dan itu tidak akan pernah muncul
 * sebagai galat.
 *
 * DILEWATI kalau `NERONA_TEST_DATABASE_URL` tidak diisi, supaya `npx vitest run`
 * tetap hijau di mesin tanpa Postgres. Jalankan dengan:
 *
 *   NERONA_TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/nerona_penjaga_uji" npx vitest run tests/integration
 *
 * JANGAN arahkan ke Supabase produksi: tes ini menulis dan menghapus baris.
 */
const url = process.env.NERONA_TEST_DATABASE_URL;

describe.skipIf(!url)("penjaga duplikat di Postgres sungguhan", () => {
  const NOL = "0000000000000000";
  const DEKAT = "0000000000000003"; // jarak 2 dari NOL
  const JAUH = "ffffffffffffffff"; // jarak 64

  let prisma: typeof import("@/lib/prisma").prisma;
  let cariDuplikatUntukUser: typeof import("@/lib/extension/duplikat").cariDuplikatUntukUser;
  let recordMetadataLog: typeof import("@/lib/metadata-log").recordMetadataLog;

  const userA = "uji-penjaga-a";
  const userB = "uji-penjaga-b";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    ({ prisma } = await import("@/lib/prisma"));
    ({ cariDuplikatUntukUser } = await import("@/lib/extension/duplikat"));
    ({ recordMetadataLog } = await import("@/lib/metadata-log"));

    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.user.createMany({
      data: [
        { id: userA, email: "uji-penjaga-a@contoh.invalid" },
        { id: userB, email: "uji-penjaga-b@contoh.invalid" },
      ],
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    // Baris riwayat ikut terhapus lewat onDelete: Cascade.
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.$disconnect();
  });

  it("menyimpan sidik lewat recordMetadataLog, bukan lewat jalur khusus tes", async () => {
    const row = await recordMetadataLog({
      userId: userA,
      marketplace: "adobe",
      pageUrl: "https://contoh.invalid/upload",
      title: "Business team meeting",
      keywords: "business meeting, laptop work",
      imageHash: "0F1E2D3C4B5A6978",
    });
    expect(row?.imageHash).toBe("0f1e2d3c4b5a6978");
  });

  it("menemukan kecocokan persis", async () => {
    await recordMetadataLog({
      userId: userA,
      marketplace: "adobe",
      pageUrl: "",
      title: "Gambar persis",
      keywords: "a",
      imageHash: NOL,
    });
    const hasil = await cariDuplikatUntukUser({ userId: userA, sidik: NOL, ambang: 10 });
    expect(hasil?.title).toBe("Gambar persis");
    expect(hasil?.jarak).toBe(0);
  });

  it("menemukan yang mirip di bawah ambang", async () => {
    const hasil = await cariDuplikatUntukUser({ userId: userA, sidik: DEKAT, ambang: 10 });
    expect(hasil?.jarak).toBe(2);
  });

  it("tidak menuduh apa pun di atas ambang", async () => {
    expect(await cariDuplikatUntukUser({ userId: userA, sidik: JAUH, ambang: 10 })).toBeNull();
  });

  it("baris tanpa sidik tidak ikut, dan tidak bikin galat", async () => {
    await recordMetadataLog({
      userId: userB,
      marketplace: "adobe",
      pageUrl: "",
      title: "Tanpa sidik",
      keywords: "a",
    });
    expect(await cariDuplikatUntukUser({ userId: userB, sidik: NOL, ambang: 10 })).toBeNull();
  });

  it("riwayat kontributor lain TIDAK pernah bocor", async () => {
    // userA punya baris dengan sidik NOL. Kalau lingkupnya bocor, userB akan
    // diberi tahu judul kiriman userA, dan tidak ada galat yang muncul.
    const hasil = await cariDuplikatUntukUser({ userId: userB, sidik: NOL, ambang: 10 });
    expect(hasil).toBeNull();
  });

  it("kalau dua sama miripnya, yang lebih baru yang disebut", async () => {
    await recordMetadataLog({
      userId: userA,
      marketplace: "adobe",
      pageUrl: "",
      title: "Yang lebih baru",
      keywords: "a",
      imageHash: NOL,
    });
    const hasil = await cariDuplikatUntukUser({ userId: userA, sidik: NOL, ambang: 10 });
    expect(hasil?.title).toBe("Yang lebih baru");
  });
});
