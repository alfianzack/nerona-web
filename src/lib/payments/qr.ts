import QRCode from "qrcode";

/**
 * Menggambar muatan QRIS jadi SVG, di server.
 *
 * SVG dan bukan PNG data-URI: ia tajam di layar mana pun dan ukurannya sepersepuluh,
 * dan yang memindainya kamera — bukan browser — jadi tidak ada gunanya bergantung
 * pada rendering klien. Dikerjakan di server juga berarti tidak ada satu kilobyte
 * pun JavaScript tambahan di halaman order.
 *
 * `null` kalau gagal digambar. Pemanggil menampilkan tautan ke halaman bayar
 * gateway sebagai gantinya — kehilangan QR bukan alasan mematikan pembayaran.
 */
export async function qrisSvg(muatan: string): Promise<string | null> {
  try {
    return await QRCode.toString(muatan, {
      type: "svg",
      // Tingkat M: QRIS bank Indonesia lazim memakainya, dan naik ke Q/H
      // memperbesar modulnya tanpa manfaat yang terasa di layar.
      errorCorrectionLevel: "M",
      margin: 1,
      // Warna gelap mengikuti navy merek; latar putih WAJIB dan tidak boleh
      // transparan — kamera memindai kontras, dan QR transparan di atas kartu
      // gradien adalah QR yang gagal dipindai di separuh perangkat.
      color: { dark: "#0B1B33", light: "#FFFFFF" },
      width: 320,
    });
  } catch {
    return null;
  }
}
