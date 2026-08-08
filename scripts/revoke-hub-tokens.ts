/**
 * One-off: cabut token Nerona Hub milik akun yang paketnya tidak menyertakan Hub.
 *
 * Sampai 2026-08-07 Hub tidak punya gerbang paket sama sekali — setiap lisensi
 * aktif bisa memakainya. Gerbang di `approvePairing` hanya berlaku untuk
 * penyambungan BARU, jadi yang terlanjur tersambung harus dibereskan di sini.
 *
 * Melapor dulu, mencabut kemudian. Jalankan tanpa `--write` untuk melihat siapa
 * saja yang akan terputus, kabari mereka, baru jalankan dengan `--write` —
 * mencabut tanpa peringatan adalah cara tercepat mendapat tiket dukungan.
 *
 *   npx tsx scripts/revoke-hub-tokens.ts            # laporan saja
 *   npx tsx scripts/revoke-hub-tokens.ts --write    # mencabut
 *
 * Idempoten: jalan kedua tidak menemukan apa pun untuk dicabut.
 */
import { prisma } from "../src/lib/prisma";
import { revokeHubTokens } from "../src/lib/device-pairing";

const WRITE = process.argv.includes("--write");

async function main() {
  // Semua pairing Hub yang tokennya masih hidup, dikelompokkan per pemilik.
  const pairings = await prisma.devicePairing.findMany({
    where: { kind: "hub", tokenId: { not: null }, userId: { not: null } },
    select: { userId: true, label: true },
  });

  const perUser = new Map<string, string[]>();
  for (const p of pairings) {
    if (!p.userId) continue;
    perUser.set(p.userId, [...(perUser.get(p.userId) ?? []), p.label]);
  }

  if (perUser.size === 0) {
    console.log("Tidak ada perangkat Hub tersambung. Tidak ada yang perlu dilakukan.");
    return;
  }

  let terdampak = 0;
  let tercabut = 0;

  for (const [userId, labels] of perUser) {
    // Lisensi TERBARU, sama seperti `lisensiBolehHub` — kalau keduanya membaca
    // baris yang berbeda, skrip ini akan mencabut orang yang sebenarnya berhak.
    const [user, license] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
      prisma.license.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { hub: true, plan: { select: { name: true } } },
      }),
    ]);

    if (license?.hub) continue;

    terdampak += 1;
    const paket = license?.plan?.name ?? "(tanpa paket)";
    console.log(`${user?.email ?? userId}  · paket ${paket}  · ${labels.join(", ")}`);

    if (WRITE) tercabut += await revokeHubTokens(userId);
  }

  if (terdampak === 0) {
    console.log("Semua perangkat Hub yang tersambung dimiliki akun yang berhak.");
    return;
  }

  console.log("");
  console.log(
    WRITE
      ? `Selesai. ${terdampak} akun terdampak, ${tercabut} token dicabut.`
      : `${terdampak} akun akan terputus. Jalankan ulang dengan --write untuk menerapkan.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
