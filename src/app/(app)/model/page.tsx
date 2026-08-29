import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModelPicker } from "@/components/model/ModelPicker";

export const metadata = { title: "Model AI — Nerona" };

export default async function ModelPage() {
  await requireUser();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader
          title="Model AI"
          description="Pilih model yang menghasilkan metadata Anda. Model yang lebih pintar biasanya lebih mahal poinnya."
        />
        <div className="mt-8">
          <ModelPicker />
        </div>
      </div>
    </main>
  );
}
