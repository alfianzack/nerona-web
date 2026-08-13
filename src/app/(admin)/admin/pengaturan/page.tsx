import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import { AdminBankSettingsPanel } from "@/components/admin/AdminBankSettingsPanel";
import { AdminAiSettingsPanel } from "@/components/admin/AdminAiSettingsPanel";
import { AdminPlanPointsPanel } from "@/components/admin/AdminPlanPointsPanel";
import { AdminDownloadSettingsPanel } from "@/components/admin/AdminDownloadSettingsPanel";
import { AdminPaymentGatewayPanel } from "@/components/admin/AdminPaymentGatewayPanel";

/**
 * Kolom CSS, bukan grid.
 *
 * Grid mengisi baris demi baris dan tinggi tiap baris ditentukan panel
 * tertingginya, jadi Harga yang panjang menyisakan lubang kosong di bawah
 * Rekening, dan panel berjumlah ganjil meninggalkan satu panel duduk sendirian
 * setengah lebar. Kolom CSS mengalirkan panel mengisi celah, jadi jumlah dan
 * tinggi panel tidak lagi mengubah kerapian halaman — panel baru boleh
 * ditambahkan tanpa memikirkan pasangannya.
 *
 * Satu panel per sel, dan `break-inside-avoid` wajib: tanpa itu satu panel bisa
 * terpotong di tengah dan sambungannya pindah ke kolom sebelah. Jarak bawah sel
 * sengaja sama dengan jarak antar kolom supaya celahnya seragam ke dua arah,
 * dan mengikuti irama antar kartu di aplikasi tenant.
 */
function Sel({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 break-inside-avoid">{children}</div>;
}

export default function AdminSettingsPage() {
  return (
    <div className="columns-1 gap-6 lg:columns-2">
      <Sel>
        <AdminPaymentGatewayPanel />
      </Sel>
      <Sel>
        <AdminBankSettingsPanel />
      </Sel>
      <Sel>
        <AdminPlanPointsPanel />
      </Sel>
      <Sel>
        <AdminDownloadSettingsPanel />
      </Sel>
      <Sel>
        <AdminPricingPanel />
      </Sel>
      <Sel>
        <AdminAiSettingsPanel />
      </Sel>
    </div>
  );
}
