import { AGENT_ENABLED } from "@/lib/features";
import { HomeMultiProduct } from "@/components/marketing/home/HomeMultiProduct";

/**
 * Beranda punya dua bentuk, dipilih oleh AGENT_ENABLED: halaman jualan
 * metadata tunggal, atau beranda dua produk. Cabang metadata-only masih
 * menampilkan beranda lama sampai HomeMetadataOnly ditulis — commit ini
 * sengaja hanya memindahkan isi, supaya bisa dipastikan tidak ada yang hilang.
 */
export default function HomePage() {
  if (!AGENT_ENABLED) {
    return <HomeMultiProduct />;
  }
  return <HomeMultiProduct />;
}
