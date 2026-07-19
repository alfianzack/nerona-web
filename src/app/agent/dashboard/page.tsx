import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { AgentLinkPanel } from "@/components/agent/AgentLinkPanel";

export default async function AgentDashboardPage() {
  const session = await requireUser();
  const profile = await getOwnProfile(session.user.id);

  if (!profile || profile.status !== "active") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-white">Nerona Agent</h1>
        <p className="mt-4 text-sm text-navy-300">
          Akun agent Anda belum aktif. Lakukan pembayaran lalu hubungi admin Nerona untuk
          mengaktifkan akses WhatsApp AI Assistant Anda.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Nerona Agent</h1>
      <AgentLinkPanel
        displayNumber={process.env.WHATSAPP_DISPLAY_NUMBER ?? ""}
        whatsappPhone={profile.whatsappPhone}
        phoneVerifiedAt={profile.phoneVerifiedAt ? profile.phoneVerifiedAt.toISOString() : null}
      />
    </main>
  );
}
