import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModelPicker } from "@/components/model/ModelPicker";
import { tenantModelScreen } from "@/lib/ai-models";

export const metadata = { title: "Model AI — Nerona" };

export default async function ModelPage() {
  const session = await requireUser();
  // Diambil di sini, bukan lewat fetch dari komponen klien. Fetch itu baru
  // berangkat setelah halaman terhidrasi, jadi ongkos basis datanya menumpuk di
  // ATAS ongkos navigasi alih-alih berbagi perjalanan yang sama.
  const layar = await tenantModelScreen(session.user.id);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader
          title="Model AI"
          description="Pilih model yang menghasilkan metadata Anda. Model yang lebih pintar biasanya lebih mahal poinnya."
        />
        <div className="mt-8">
          <ModelPicker
            models={layar.models}
            selectedId={layar.selectedId}
            tier={layar.tier}
          />
        </div>
      </div>
    </main>
  );
}
