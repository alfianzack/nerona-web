import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "./jobs";
import { getRecentHistory, logOutbound } from "./messages";
import { listRecentFacts } from "./memory";
import { buildSystemPrompt, toClaudeHistory } from "./context";
import { generateReply } from "./claude-client";
import { sendWhatsAppText } from "./whatsapp-client";
import { getBalance, spendPoints } from "@/lib/points";
import { costForUsage } from "./pricing";

const FAILURE_APOLOGY =
  "Maaf, ada kendala teknis di sisi kami. Coba kirim pesan itu lagi sebentar ya.";
const OUT_OF_POINTS =
  "Maaf, poin kamu sudah habis. Silakan isi ulang poin untuk melanjutkan pakai asisten AI.";

export async function processJob(jobId: string): Promise<void> {
  const job = await beginProcessing(jobId);

  try {
    const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
    if (!profile || !profile.whatsappPhone) {
      throw new Error(`AgentProfile ${job.profileId} not found or has no phone`);
    }

    // Gate: refuse the AI call when the wallet is empty.
    const balance = await getBalance(profile.userId);
    if (balance <= 0) {
      await sendWhatsAppText(profile.whatsappPhone, OUT_OF_POINTS);
      await logOutbound({ profileId: profile.id, phone: profile.whatsappPhone, body: OUT_OF_POINTS });
      await completeJob(jobId);
      return;
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

    const result = await generateReply({
      systemPrompt,
      history: toClaudeHistory(history),
    });

    await sendWhatsAppText(profile.whatsappPhone, result.text);
    await logOutbound({ profileId: profile.id, phone: profile.whatsappPhone, body: result.text });

    // Meter the call against the wallet (best-effort; a failure here must not
    // undo the reply that already went out).
    try {
      const cost = costForUsage({ model: result.model, usage: result.usage });
      await spendPoints({
        userId: profile.userId,
        cost,
        note: `AI reply · ${result.model} · ${result.usage?.promptTokens ?? 0}+${result.usage?.completionTokens ?? 0} tok`,
      });
    } catch (spendErr) {
      console.error("[process-job] spendPoints failed", spendErr);
    }

    await completeJob(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { permanentlyFailed } = await failJob(jobId, job.attempts, message);

    if (permanentlyFailed) {
      try {
        const profile = await prisma.agentProfile.findUnique({ where: { id: job.profileId } });
        if (profile?.whatsappPhone) {
          await sendWhatsAppText(profile.whatsappPhone, FAILURE_APOLOGY).catch(() => {});
          await logOutbound({
            profileId: profile.id,
            phone: profile.whatsappPhone,
            body: FAILURE_APOLOGY,
          }).catch(() => {});
        }
      } catch {
        // best-effort apology; a failure here must not mask that failJob already ran
      }
    }
  }
}
