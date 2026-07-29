import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { AgentLinkPanel } from "@/components/agent/AgentLinkPanel";

export default async function AgentDashboardPage() {
  const session = await requireUser();
  const profile = await getOwnProfile(session.user.id);

  if (!profile || profile.status !== "active") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-ink">Nerona Agent</h1>
        <p className="mt-4 text-sm text-muted">
          Akun agent Anda belum aktif. Lakukan pembayaran lalu hubungi admin Nerona untuk
          mengaktifkan akses WhatsApp AI Assistant Anda.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink">Nerona Agent</h1>
      <p className="mt-2 text-sm text-muted">
        Sudah bisa dipakai sekarang lewat{" "}
        <Link href="/agent/chat" className="text-gold-500 hover:underline">
          Chat Asisten
        </Link>{" "}
        — menghubungkan WhatsApp bersifat opsional.
      </p>
      <AgentLinkPanel
        displayNumber={process.env.WHATSAPP_DISPLAY_NUMBER ?? ""}
        whatsappPhone={profile.whatsappPhone}
        phoneVerifiedAt={profile.phoneVerifiedAt ? profile.phoneVerifiedAt.toISOString() : null}
      />
    </main>
  );
}
