/**
 * Mengecilkan gambar di browser sebelum dikirim ke Coba prompt.
 *
 * Angkanya sama dengan extension (nerona_medata/content.js, NERONA_VISION_*),
 * supaya yang dilihat model di uji ini sama dengan yang dilihatnya saat
 * extension mengirim gambar yang sama. Beda ukuran berarti beda token, dan
 * beda token berarti angka poin di layar ini tidak mewakili generate aslinya.
 */
export const SISI_MAKS = 1280;
export const MUTU_JPEG = 0.88;
/** Di bawah ini gambar raster dikirim apa adanya, seperti extension. */
export const LEWATI_DI_BAWAH_BYTE = 300 * 1024;

export const MIME_DITERIMA = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] as const;

export interface GambarSiap {
  mime: "image/jpeg" | "image/png" | "image/webp";
  dataBase64: string;
}

/** Ukuran hasil: sisi terpanjang paling banyak `maks`, tidak pernah diperbesar. */
export function ukuranTarget(lebar: number, tinggi: number, maks = SISI_MAKS) {
  const panjang = Math.max(lebar, tinggi);
  if (!panjang || panjang <= maks) return { lebar: Math.round(lebar), tinggi: Math.round(tinggi) };
  const skala = maks / panjang;
  return { lebar: Math.round(lebar * skala), tinggi: Math.round(tinggi * skala) };
}

function bacaDataUrl(blob: Blob): Promise<string> {
  return new Promise((selesai, gagal) => {
    const r = new FileReader();
    r.onload = () => selesai(String(r.result));
    r.onerror = () => gagal(r.error);
    r.readAsDataURL(blob);
  });
}

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((selesai, gagal) => {
    const img = new Image();
    img.onload = () => selesai(img);
    img.onerror = () => gagal(new Error("gambar tidak terbaca"));
    img.src = url;
  });
}

/**
 * SVG selalu dirasterkan ke JPEG: SVG mentah membuat model membalas dengan
 * prosa, bukan JSON. Latarnya diisi putih dulu karena JPEG tidak punya
 * transparansi, dan SVG tanpa latar akan jadi hitam.
 */
export async function kecilkanGambar(berkas: File): Promise<GambarSiap> {
  const svg = berkas.type === "image/svg+xml";
  if (!svg && berkas.size <= LEWATI_DI_BAWAH_BYTE) {
    const url = await bacaDataUrl(berkas);
    return { mime: berkas.type as GambarSiap["mime"], dataBase64: url.slice(url.indexOf(",") + 1) };
  }

  const objek = URL.createObjectURL(berkas);
  try {
    const img = await muatGambar(objek);
    // SVG tanpa atribut width/height melaporkan 0; 1280 persegi jadi titik awalnya.
    const asal = { lebar: img.naturalWidth || SISI_MAKS, tinggi: img.naturalHeight || SISI_MAKS };
    const { lebar, tinggi } = ukuranTarget(asal.lebar, asal.tinggi);
    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) throw new Error("kanvas tidak tersedia");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.drawImage(img, 0, 0, lebar, tinggi);
    const url = kanvas.toDataURL("image/jpeg", MUTU_JPEG);
    return { mime: "image/jpeg", dataBase64: url.slice(url.indexOf(",") + 1) };
  } finally {
    URL.revokeObjectURL(objek);
  }
}
