import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { PromptPresetManager } from "@/components/prompt/PromptPresetManager";
import { tenantModelScreen } from "@/lib/ai-models";
import { getExtensionAccountState } from "@/lib/extension-sync";

export const metadata = { title: "Prompt Metadata · Nerona" };

export default async function PromptPage() {
  const session = await requireUser();
  // Daftar model dan saldo untuk kartu Coba prompt diambil di server, sama
  // seperti layar Model AI: fetch dari klien baru berangkat setelah hidrasi.
  const [layar, akun] = await Promise.all([
    tenantModelScreen(session.user.id),
    getExtensionAccountState(session.user.id),
  ]);

  return (
    <main className="bg-canvas">
      {/* Lebih lebar dari layar lain karena dua kolom: menulis prompt di kiri, mencobanya di kanan. */}
      <div className="mx-auto max-w-6xl px-6 py-band">
        <PageHeader
          title="Prompt Metadata"
          description="Pakai prompt bawaan Nerona, atau tulis prompt Anda sendiri untuk niche tertentu. Berlaku untuk extension dan Nerona Hub."
        />
        <div className="mt-8">
          <PromptPresetManager
            models={layar.models.map(({ id, label, estimatedPoints, isDefault }) => ({
              id,
              label,
              estimatedPoints,
              isDefault,
            }))}
            modelTersimpanId={layar.selectedId}
            saldo={akun.pointsBalance}
          />
        </div>
      </div>
    </main>
  );
}
