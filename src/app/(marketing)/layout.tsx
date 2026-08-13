import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { Footer } from "@/components/layout/Footer";

// data-surface memilih set token "Bening" untuk halaman publik: satu warna
// aksi, sudut lebih besar, tombol utama berbentuk pil, dan irama antar bagian
// 104px. Aplikasi mewarisi set bawaan di :root. Seluruh peralihan terjadi
// lewat pewarisan CSS — tanpa JavaScript, tanpa context, tanpa kedip.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-surface="marketing" className="flex min-h-screen flex-col bg-canvas">
      <MarketingHeader />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
