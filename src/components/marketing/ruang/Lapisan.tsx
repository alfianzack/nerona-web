/**
 * Satu lapisan di dalam RuangKata: seksi pada kedalaman tertentu.
 *
 * Server component sengaja — isinya seksi-seksi async yang mengambil data,
 * dan RuangKata (client) cukup membaca `data-z`/`data-nama` dari DOM. Dengan
 * begitu tidak ada satu pun seksi yang harus jadi client component hanya
 * karena ia berdiri di dalam ruang.
 *
 * `.ruang-isi` adalah kotak yang dilindungi dari kata: kotak ISI, bukan kotak
 * lapisan, karena kartu hero dan grid harga tidak setinggi lapisannya dan kata
 * masih boleh lewat di atas/bawahnya.
 */
export function Lapisan({
  z,
  nama,
  id,
  children,
}: {
  /** Kedalaman; lapisan tajam saat kamera berjarak F darinya. */
  z: number;
  /** Nama di rel kedalaman. */
  nama: string;
  /** Anchor (#pricing, #faq) — dicegat RuangKata dan diterjemahkan jadi selam. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} data-z={z} data-nama={nama} className="ruang-lapisan">
      <div className="ruang-isi">{children}</div>
    </section>
  );
}
