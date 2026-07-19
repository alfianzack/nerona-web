import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/whatsapp-client", () => ({
  verifyWebhookSignature: vi.fn(),
  sendWhatsAppText: vi.fn(),
}));
vi.mock("@/lib/agent/messages", () => ({
  isDuplicateMessage: vi.fn(),
  logInbound: vi.fn(),
  logOutbound: vi.fn(),
}));
vi.mock("@/lib/agent/profile", () => ({
  findProfileByPhone: vi.fn(),
  matchesLinkCode: vi.fn(),
  markPhoneVerified: vi.fn(),
}));
vi.mock("@/lib/agent/jobs", () => ({
  createJob: vi.fn(),
}));
vi.mock("@/lib/agent/process-job", () => ({
  processJob: vi.fn(),
}));
vi.mock("@/lib/agent/wait-until", () => ({
  runInBackground: vi.fn(),
}));
vi.mock("@/lib/base-url", () => ({
  baseUrl: () => "http://localhost:3000",
}));
vi.mock("@/lib/agent/limits", () => ({
  hasExceededMonthlyLimit: vi.fn(),
}));

import {
  handleIncomingWebhook,
  handleWebhookVerification,
} from "@/lib/agent/webhook-handler";
import { sendWhatsAppText, verifyWebhookSignature } from "@/lib/agent/whatsapp-client";
import { isDuplicateMessage, logInbound, logOutbound } from "@/lib/agent/messages";
import { findProfileByPhone, matchesLinkCode, markPhoneVerified } from "@/lib/agent/profile";
import { createJob } from "@/lib/agent/jobs";
import { processJob } from "@/lib/agent/process-job";
import { runInBackground } from "@/lib/agent/wait-until";
import { hasExceededMonthlyLimit } from "@/lib/agent/limits";

function textPayload(from: string, body: string, id = "wamid.1") {
  return JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ from, id, type: "text", text: { body } }],
            },
          },
        ],
      },
    ],
  });
}

describe("handleWebhookVerification", () => {
  const originalToken = process.env.WHATSAPP_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
  });

  afterEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = originalToken;
  });

  it("echoes the challenge when mode and token match", async () => {
    const result = await handleWebhookVerification({
      mode: "subscribe",
      token: "verify-me",
      challenge: "abc123",
    });
    expect(result).toEqual({ status: 200, body: "abc123" });
  });

  it("rejects a mismatched token", async () => {
    const result = await handleWebhookVerification({
      mode: "subscribe",
      token: "wrong",
      challenge: "abc123",
    });
    expect(result.status).toBe(403);
  });
});

describe("handleIncomingWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyWebhookSignature as any).mockReturnValue(true);
    (isDuplicateMessage as any).mockResolvedValue(false);
  });

  it("returns 401 and does nothing else when the signature is invalid", async () => {
    (verifyWebhookSignature as any).mockReturnValue(false);

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=bad");

    expect(result.status).toBe(401);
    expect(isDuplicateMessage).not.toHaveBeenCalled();
  });

  it("acks status-callback payloads with no messages array", async () => {
    const result = await handleIncomingWebhook(
      JSON.stringify({ entry: [{ changes: [{ value: { statuses: [] } }] }] }),
      "sha256=ok"
    );

    expect(result.status).toBe(200);
    expect(findProfileByPhone).not.toHaveBeenCalled();
  });

  it("skips a duplicate message", async () => {
    (isDuplicateMessage as any).mockResolvedValue(true);

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(logInbound).not.toHaveBeenCalled();
  });

  it("replies with a text-only message for non-text payloads and creates no job", async () => {
    const payload = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: "15551234567", id: "wamid.1", type: "image" }],
              },
            },
          ],
        },
      ],
    });

    const result = await handleIncomingWebhook(payload, "sha256=ok");

    expect(result.status).toBe(200);
    expect(logInbound).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: null, body: "[image]" })
    );
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("teks")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("replies with a signup link for an unknown sender", async () => {
    (findProfileByPhone as any).mockResolvedValue(null);

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(logInbound).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: null, body: "hi" })
    );
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("http://localhost:3000/agent/dashboard")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("replies with an inactive-account message when the profile isn't active", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "pending",
      phoneVerifiedAt: null,
    });

    const result = await handleIncomingWebhook(textPayload("15551234567", "hi"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("belum aktif")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("verifies the phone when the link code matches", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      phoneVerifiedAt: null,
      linkCode: "123456",
      linkCodeExpires: new Date(Date.now() + 60_000),
    });
    (matchesLinkCode as any).mockReturnValue(true);

    const result = await handleIncomingWebhook(textPayload("15551234567", "123456"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(markPhoneVerified).toHaveBeenCalledWith("profile-1");
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("terhubung")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("asks the sender to link via the dashboard when the code doesn't match", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      phoneVerifiedAt: null,
      linkCode: "123456",
      linkCodeExpires: new Date(Date.now() + 60_000),
    });
    (matchesLinkCode as any).mockReturnValue(false);

    const result = await handleIncomingWebhook(textPayload("15551234567", "wrong"), "sha256=ok");

    expect(result.status).toBe(200);
    expect(markPhoneVerified).not.toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("dashboard")
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("creates a job and runs it in the background for a verified, active profile", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      plan: "free",
      phoneVerifiedAt: new Date(),
    });
    (hasExceededMonthlyLimit as any).mockResolvedValue(false);
    (createJob as any).mockResolvedValue({ id: "job-1" });

    const result = await handleIncomingWebhook(
      textPayload("15551234567", "ada produk apa saja?"),
      "sha256=ok"
    );

    expect(result.status).toBe(200);
    expect(hasExceededMonthlyLimit).toHaveBeenCalledWith("profile-1", "free");
    expect(createJob).toHaveBeenCalledWith({
      profileId: "profile-1",
      waMessageId: "wamid.1",
      payload: expect.any(String),
    });
    expect(runInBackground).toHaveBeenCalledTimes(1);
    expect(processJob).toHaveBeenCalledWith("job-1");
  });

  it("replies with an upgrade message and creates no job when the monthly limit is exceeded", async () => {
    (findProfileByPhone as any).mockResolvedValue({
      id: "profile-1",
      status: "active",
      plan: "free",
      phoneVerifiedAt: new Date(),
    });
    (hasExceededMonthlyLimit as any).mockResolvedValue(true);

    const result = await handleIncomingWebhook(
      textPayload("15551234567", "halo"),
      "sha256=ok"
    );

    expect(result.status).toBe(200);
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("Kuota pesan bulanan")
    );
    expect(createJob).not.toHaveBeenCalled();
  });
});
