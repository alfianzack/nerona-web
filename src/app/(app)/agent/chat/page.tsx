import Link from "next/link";
import { requireUser } from "@/lib/session-guards";
import { getOwnProfile } from "@/lib/agent/profile";
import { listChatHistory } from "@/lib/agent/messages";
import { getBalance } from "@/lib/points";
import { AgentChatPanel } from "@/components/agent/AgentChatPanel";

export default async function AgentChatPage() {
  const session = await requireUser();
  const profile = await getOwnProfile(session.user.id);

  if (!profile || profile.status !== "active") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-ink">Chat Asisten</h1>
        <p className="mt-4 text-sm text-muted">
          Akun agent Anda belum aktif. Lakukan pembayaran lalu hubungi admin Nerona untuk
          mengaktifkan asisten AI Anda.
        </p>
      </main>
    );
  }

  const [history, points] = await Promise.all([
    listChatHistory(profile.id, 50),
    getBalance(profile.userId),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-ink">Chat Asisten</h1>
      <p className="mt-2 text-sm text-muted">
        Asisten yang sama dengan WhatsApp.{" "}
        <Link href="/agent/dashboard" className="text-gold-500 hover:underline">
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
    </main>
  );
}
