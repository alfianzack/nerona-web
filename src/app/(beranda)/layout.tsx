import { MarketingHeader } from "@/components/layout/MarketingHeader";

/**
 * Beranda: layout publik TANPA Footer.
 *
 * Grup rute tersendiri, bukan cabang di layout (marketing): beranda adalah
 * Ruang Kata, dan Footer yang muncul sesudah wadahnya habis terbaca sebagai
 * halaman kedua yang tertinggal di bawah panggung — owner memintanya dihapus.
 * Yang dikerjakan Footer di halaman lain (kontak, tautan legal) di sini
 * dikerjakan lapisan penutup lewat KontakRuang, jadi tidak ada satu pun cara
 * menghubungi tim yang hilang dari beranda.
 *
 * data-surface="marketing" tetap: token Bening (amber aksi, pil, irama publik)
 * dipilih lewat atribut ini, dan Ruang Kata menimpanya lagi dengan
 * data-surface="ruang" di dalam wadahnya sendiri.
 */
export default function BerandaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="marketing" className="flex min-h-screen flex-col bg-canvas">
      <MarketingHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
