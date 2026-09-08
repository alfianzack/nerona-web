import { ImageResponse } from "next/og";

/**
 * Runtime edge WAJIB, dan ini bukan pilihan gaya.
 *
 * Di runtime node, `@vercel/og` melempar `TypeError: Invalid URL` saat
 * modulnya dimuat — `fileURLToPath` gagal atas jalur berkas hurufnya di
 * Windows — dan kegagalannya muncul sebagai `next build` yang MERAH di
 * langkah prerender, bukan sebagai gambar yang jelek. Terbukti dengan
 * menjalankan build-nya dua kali, bukan diduga.
 *
 * Jadi kalau baris ini dihapus, yang patah adalah build-nya.
 */
export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nerona Metadata — metadata AI untuk kontributor stock";

/**
 * Gambar pratinjau tautan, DIGENERATE, bukan berkas PNG yang diekspor tangan.
 *
 * Alasannya sama dengan alasan angka pemasaran dihitung alih-alih diketik:
 * gambar yang dibuat tangan akan menyebut harga atau jumlah marketplace yang
 * basi, dan tidak ada yang akan ingat mengekspornya ulang. Karena itu isinya
 * dibatasi pada dua hal yang tidak bergantung pada basis data — bentuk
 * produknya dan janji utamanya.
 *
 * Tanpa memuat huruf apa pun: `next/og` memakai huruf bawaannya, dan mengambil
 * berkas Inter dari jaringan di dalam fungsi ini berarti satu permintaan yang
 * bisa gagal setiap kali sebuah tautan dibagikan. Warnanya ditulis sebagai hex
 * lepas, dan ini satu-satunya tempat di repo yang boleh: berkas ini dirender
 * di Satori, bukan di peramban, jadi tidak ada custom property untuk dibaca.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 88,
          background: "#16233d",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: "#f2a93b",
          }}
        >
          Ekstensi Chrome
        </div>
        <div style={{ marginTop: 28, fontSize: 68, fontWeight: 600, lineHeight: 1.12 }}>
          Metadata untuk kontributor stock, ditulis otomatis.
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#c7cdeb" }}>Nerona Metadata</div>
      </div>
    ),
    size
  );
}
