import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Thumbnail satu baris generate.
 *
 * Kenapa ada: tautan provider berumur pendek (jam sampai hari), dan owner
 * memutuskan Nerona TIDAK menyimpan gambar penuh. Tanpa thumbnail, galeri
 * berubah jadi deretan kotak kosong begitu tautannya mati, dan tenant kehilangan
 * satu-satunya cara mengenali hasil yang pernah ia buat.
 *
 * Gambarnya dikecilkan DI BROWSER, bukan di server: `sharp` bukan dependensi
 * repo ini, dan menambah dependensi native hanya untuk memperkecil gambar itu
 * mahal. Konsekuensinya bytes-nya datang dari klien, dan itu sebabnya rute ini
 * memeriksa ukuran dan isi, bukan percaya pada Content-Type.
 */

/** 64 KB. Thumbnail 256px JPEG mutu 0,7 jatuh di sekitar 15 sampai 25 KB. */
const MAKS_BYTE = 64 * 1024;

/**
 * Angka ajaib tiga format yang diterima. Content-Type dikirim klien, jadi ia
 * janji, bukan bukti: tanpa pemeriksaan ini kolom bernama thumbnail bisa berisi
 * apa saja, dan GET di bawah akan menyajikannya kembali ke browser sebagai
 * gambar.
 */
function jenisGambar(b: Uint8Array): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "image/png";
  }
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

async function barisMilikSendiri(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { galat: 401 as const };
  // userId ikut di WHERE, bukan diperiksa sesudahnya: siapa pun yang tahu sebuah
  // id tidak boleh bisa menempelkan gambar ke galeri orang lain.
  const baris = await prisma.imageGeneration.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!baris) return { galat: 404 as const };
  return { baris };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const hasil = await barisMilikSendiri(params.id);
  if (hasil.galat) {
    return NextResponse.json({ ok: false }, { status: hasil.galat });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ ok: false, error: "kosong" }, { status: 400 });
  }
  if (bytes.byteLength > MAKS_BYTE) {
    return NextResponse.json({ ok: false, error: "terlalu_besar" }, { status: 413 });
  }
  const mime = jenisGambar(bytes);
  if (!mime) {
    return NextResponse.json({ ok: false, error: "bukan_gambar" }, { status: 415 });
  }

  await prisma.imageGeneration.update({
    where: { id: params.id },
    data: { thumbnail: Buffer.from(bytes), thumbMime: mime },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const hasil = await barisMilikSendiri(params.id);
  if (hasil.galat) {
    return NextResponse.json({ ok: false }, { status: hasil.galat });
  }
  const { thumbnail, thumbMime } = hasil.baris;
  if (!thumbnail) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return new Response(Buffer.from(thumbnail), {
    headers: {
      "Content-Type": thumbMime || "image/jpeg",
      // private: berkas ini milik satu tenant dan tidak boleh nyangkut di cache
      // bersama. immutable: isinya tidak pernah berubah untuk id yang sama.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
