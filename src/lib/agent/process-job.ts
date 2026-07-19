import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "./jobs";
import { getRecentHistory, logOutbound } from "./messages";
import { listRecentFacts } from "./memory";
import { buildSystemPrompt, toClaudeHistory } from "./context";
import { generateReply } from "./claude-client";
import { sendWhatsAppText } from "./whatsapp-client";

const FAILURE_APOLOGY =
  "Maaf, ada kendala teknis di sisi kami. Coba kirim pesan itu lagi sebentar ya.";

export async function processJob(jobId: string): Promise<void> {
  const job = await beginProcessing(jobId);

  try {
    const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
    if (!profile || !profile.whatsappPhone) {
      throw new Error(`AgentProfile ${job.profileId} not found or has no phone`);
    }

    const [facts, history] = await Promise.all([
      listRecentFacts(profile.id),
      getRecentHistory(profile.id, 20),
    ]);

    const systemPrompt = buildSystemPrompt({
      businessName: profile.businessName,
      timezone: profile.timezone,
      facts,
    });

    const reply = await generateReply({
      systemPrompt,
      history: toClaudeHistory(history),
    });

    await sendWhatsAppText(profile.whatsappPhone, reply);
    await logOutbound({ profileId: profile.id, phone: profile.whatsappPhone, body: reply });
    await completeJob(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { permanentlyFailed } = await failJob(jobId, job.attempts, message);

    if (permanentlyFailed) {
      const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
      if (profile?.whatsappPhone) {
        await sendWhatsAppText(profile.whatsappPhone, FAILURE_APOLOGY).catch(() => {});
        await logOutbound({
          profileId: profile.id,
          phone: profile.whatsappPhone,
          body: FAILURE_APOLOGY,
        }).catch(() => {});
      }
    }
  }
}
