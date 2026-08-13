import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { listChatHistory } from "@/lib/agent/messages";
import { getBalance } from "@/lib/points";
import { AGENT_ENABLED } from "@/lib/features";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentChatPanel } from "@/components/agent/AgentChatPanel";

export default async function AgentChatPage() {
  // redirect, bukan 404: bookmark lama mendarat di tempat yang berguna.
  if (!AGENT_ENABLED) redirect("/dashboard");

  const session = await requireUser();
  const profile = await getOwnProfile(session.user.id);

  if (!profile || profile.status !== "active") {
    return (
      <main className="bg-canvas">
        <div className="mx-auto max-w-2xl px-6 py-band">
          <PageHeader
            title="Chat Asisten"
            description="Akun agent Anda belum aktif. Lakukan pembayaran lalu hubungi admin Nerona untuk mengaktifkan asisten AI Anda."
          />
        </div>
      </main>
    );
  }

  const [history, points] = await Promise.all([
    listChatHistory(profile.id, 50),
    getBalance(profile.userId),
  ]);

  return (
    <main className="bg-canvas">
      <div className="mx-auto max-w-2xl px-6 py-band">
        <PageHeader title="Chat Asisten" />

        {/* Tautan di tengah kalimat memakai warna aksen biasa, bukan TextLink:
            kurung sudut milik aksi kedua yang berdiri sendiri, dan di tengah
            kalimat ia terbaca sebagai tanda baca yang salah. */}
        <p className="mt-3 text-body text-muted">
          Asisten yang sama dengan WhatsApp.{" "}
          <Link href="/agent/dashboard" className="text-accent hover:underline">
            Hubungkan nomor WhatsApp
          </Link>{" "}
          kalau ingin memakainya dari HP juga.
        </p>

        <AgentChatPanel
          initialMessages={history.map((m) => ({
            direction: m.direction,
            body: m.body,
            channel: m.channel,
          }))}
          initialPoints={points}
        />
      </div>
    </main>
  );
}
