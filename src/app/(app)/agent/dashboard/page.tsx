import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { AGENT_ENABLED } from "@/lib/features";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentLinkPanel } from "@/components/agent/AgentLinkPanel";

export default async function AgentDashboardPage() {
  // redirect, bukan 404: bookmark lama mendarat di tempat yang berguna.
  if (!AGENT_ENABLED) redirect("/dashboard");

  const session = await requireUser();
  const profile = await getOwnProfile(session.user.id);

  if (!profile || profile.status !== "active") {
    return (
      <main className="bg-canvas">
        <div className="mx-auto max-w-2xl px-6 py-band">
          <PageHeader
            title="Nerona Agent"
            description="Akun agent Anda belum aktif. Lakukan pembayaran lalu hubungi admin Nerona untuk mengaktifkan akses WhatsApp AI Assistant Anda."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-2xl px-6 py-band">
        <PageHeader title="Nerona Agent" />

        {/* Tautan di tengah kalimat memakai warna aksen biasa, bukan TextLink:
            kurung sudut milik aksi kedua yang berdiri sendiri. */}
        <p className="mt-3 text-body text-muted">
          Sudah bisa dipakai sekarang lewat{" "}
          <Link href="/agent/chat" className="text-accent hover:underline">
            Chat Asisten
          </Link>{" "}
          — menghubungkan WhatsApp bersifat opsional.
        </p>

        <AgentLinkPanel
          displayNumber={process.env.WHATSAPP_DISPLAY_NUMBER ?? ""}
          whatsappPhone={profile.whatsappPhone}
          phoneVerifiedAt={profile.phoneVerifiedAt ? profile.phoneVerifiedAt.toISOString() : null}
        />
      </div>
    </main>
  );
}
