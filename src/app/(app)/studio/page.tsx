import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { StudioGenerator, type HasilGenerate } from "@/components/studio/StudioGenerator";
import { prisma } from "@/lib/prisma";
import { costForImage } from "@/lib/agent/pricing";
import { getAiSettings } from "@/lib/ai-settings";
import { getExtensionAccountState } from "@/lib/extension-sync";

export const metadata = { title: "Studio — Nerona" };

/**
 * Ongkos per gambar dihitung DI SERVER dari baris modelnya, bukan ditulis di
 * komponen. Angka yang dijanjikan tombol harus sama dengan yang dipotong, dan
 * satu-satunya cara menjaminnya adalah keduanya memanggil costForImage.
 */
async function ongkosPerGambar(): Promise<number | null> {
  const [row, settings] = await Promise.all([
    prisma.aiModel.findFirst({ where: { kind: "image", isDefault: true, active: true } }),
    getAiSettings(),
  ]);
  if (!row) return null;
  try {
    return costForImage({
      usdPerImage: (row as { usdPerImage: number | null }).usdPerImage,
      pointsPerUsd: settings.pricing.pointsPerUsd,
    });
  } catch {
    // Baris tanpa tarif diperlakukan sama dengan belum ada model: layarnya
    // mengatakan belum aktif, bukan menampilkan harga yang salah.
    return null;
  }
}

export default async function StudioPage() {
  const session = await requireUser();
  const userId = session.user.id;

  const [poin, state, baris] = await Promise.all([
    ongkosPerGambar(),
    getExtensionAccountState(userId),
    prisma.imageGeneration.findMany({
      where: { userId, status: "ok" },
      orderBy: { createdAt: "desc" },
      take: 48,
      // Kolom `thumbnail` SENGAJA tidak ikut: 48 baris x 20 KB akan menyeret
      // 1 MB bytes ke memori server untuk merender halaman yang tidak
      // menampilkannya. Yang dibutuhkan cuma tahu ADA atau tidak, dan itu
      // dijawab thumbMime. Bytes-nya diambil per kartu lewat rutenya sendiri.
      select: {
        id: true,
        prompt: true,
        providerUrl: true,
        urlExpiresAt: true,
        points: true,
        createdAt: true,
        thumbMime: true,
      },
    }),
  ]);

  const sekarang = Date.now();
  const awal: HasilGenerate[] = baris.map((b) => ({
    id: b.id,
    prompt: b.prompt,
    url: b.providerUrl ?? "",
    points: b.points,
    // Tautan provider berumur pendek. Baris yang lewat masanya tetap tampil
    // dengan prompt-nya, karena itu yang membuatnya bisa dibuat ulang.
    hidup: Boolean(b.providerUrl) && (!b.urlExpiresAt || b.urlExpiresAt.getTime() > sekarang),
    waktu: b.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    punyaThumb: Boolean(b.thumbMime),
  }));

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-band">
        <PageHeader
          title="Studio"
          description="Tulis apa yang ingin kamu buat, lalu Nerona membuatnya. Hasilnya bisa diunduh langsung; metadata dan unggah ke marketplace menyusul di tahap berikutnya."
        />
        <div className="mt-8">
          <StudioGenerator poinPerGambar={poin} saldo={state.pointsBalance} awal={awal} />
        </div>
      </div>
    </main>
  );
}
