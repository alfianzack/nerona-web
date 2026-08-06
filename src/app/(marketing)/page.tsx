import { AGENT_ENABLED } from "@/lib/features";
import { HomeMetadataOnly } from "@/components/marketing/home/HomeMetadataOnly";
import { HomeMultiProduct } from "@/components/marketing/home/HomeMultiProduct";

/**
 * Beranda punya dua bentuk, dipilih oleh AGENT_ENABLED: halaman jualan
 * metadata tunggal, atau beranda dua produk.
 */
export default function HomePage() {
  return AGENT_ENABLED ? <HomeMultiProduct /> : <HomeMetadataOnly />;
}
