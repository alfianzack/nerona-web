import { baseUrl } from "@/lib/base-url";
import { verifyWebhookSignature, sendWhatsAppText } from "./whatsapp-client";
import { timingSafeEqualStr } from "@/lib/timing-safe";
import { isDuplicateMessage, logInbound, logOutbound } from "./messages";
import { findProfileByPhone, matchesLinkCode, markPhoneVerified } from "./profile";
import { createJob } from "./jobs";
import { processJob } from "./process-job";
import { runInBackground } from "./wait-until";
import { hasExceededMonthlyLimit } from "./limits";
import { isAgentPlanExpired } from "./admin";

export async function handleWebhookVerification(params: {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}): Promise<{ status: number; body: string }> {
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    params.mode === "subscribe" &&
    expectedToken &&
    params.token != null &&
    timingSafeEqualStr(params.token, expectedToken)
  ) {
    return { status: 200, body: params.challenge ?? "" };
  }
  return { status: 403, body: "Forbidden" };
}

async function replyStatic(phone: string, profileId: string | null, body: string): Promise<void> {
  await sendWhatsAppText(phone, body);
  await logOutbound({ profileId, phone, body });
}

export async function handleIncomingWebhook(
  rawBody: string,
  signatureHeader: string | null
): Promise<{ status: number }> {
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    return { status: 401 };
  }

  const payload = JSON.parse(rawBody);
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) {
    return { status: 200 };
  }

  const waMessageId = message.id as string;
  const phone = `+${message.from}`;

  if (await isDuplicateMessage(waMessageId)) {
    return { status: 200 };
  }

  if (message.type !== "text") {
    await logInbound({ profileId: null, waMessageId, phone, body: `[${message.type}]` });
    await replyStatic(phone, null, "Maaf, saat ini saya hanya bisa membaca pesan teks ya.");
    return { status: 200 };
  }

  const text = String(message.text?.body ?? "");
  const profile = await findProfileByPhone(phone);

  if (!profile) {
    await logInbound({ profileId: null, waMessageId, phone, body: text });
    await replyStatic(
      phone,
      null,
      `Nomor ini belum terdaftar di Nerona Agent. Daftar dulu di ${baseUrl()}/agent/dashboard`
    );
    return { status: 200 };
  }

  await logInbound({ profileId: profile.id, waMessageId, phone, body: text });

  if (profile.status !== "active") {
    await replyStatic(
      phone,
      profile.id,
      "Akun agent Anda belum aktif. Hubungi admin Nerona untuk mengaktifkan akun."
    );
    return { status: 200 };
  }

  if (!profile.phoneVerifiedAt) {
    if (matchesLinkCode(profile, text)) {
      await markPhoneVerified(profile.id);
      await replyStatic(
        phone,
        profile.id,
        "Nomor WhatsApp Anda berhasil terhubung! Sekarang Anda bisa mulai chat dengan saya."
      );
    } else {
      await replyStatic(
        phone,
        profile.id,
        "Nomor ini belum terverifikasi. Buka dashboard Nerona Agent untuk mendapatkan kode verifikasi."
      );
    }
    return { status: 200 };
  }

  if (isAgentPlanExpired(profile)) {
    await replyStatic(
      phone,
      profile.id,
      `Paket Anda sudah berakhir. Silakan perpanjang di ${baseUrl()}/agent untuk melanjutkan.`
    );
    return { status: 200 };
  }

  if (await hasExceededMonthlyLimit(profile.id, profile.plan)) {
    await replyStatic(
      phone,
      profile.id,
      `Kuota pesan bulanan paket Anda sudah habis. Upgrade paket di ${baseUrl()}/agent untuk melanjutkan.`
    );
    return { status: 200 };
  }

  const job = await createJob({ profileId: profile.id, waMessageId, payload: rawBody });
  runInBackground(processJob(job.id));

  return { status: 200 };
}
