import { prisma } from "@/lib/prisma";
import { beginProcessing, completeJob, failJob } from "./jobs";
import { logOutbound } from "./messages";
import { runAgentTurn } from "./turn";
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

    // Gates, generation, reply logging and metering are shared with the web
    // channel; this path only has to deliver the result over WhatsApp.
    const turn = await runAgentTurn({ profile, channel: "whatsapp" });
    await sendWhatsAppText(profile.whatsappPhone, turn.reply);

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
