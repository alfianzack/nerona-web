import { requireUser } from "@/lib/session-guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { PromptPresetManager } from "@/components/prompt/PromptPresetManager";

export const metadata = { title: "Prompt Metadata — Nerona" };

export default async function PromptPage() {
  await requireUser();

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-band">
        <PageHeader
          title="Prompt Metadata"
          description="Pakai prompt bawaan Nerona, atau tulis prompt Anda sendiri untuk niche tertentu. Berlaku untuk extension dan Nerona Hub."
        />
        <div className="mt-8">
          <PromptPresetManager />
        </div>
      </div>
    </main>
  );
}
