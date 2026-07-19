import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendWhatsAppText, verifyWebhookSignature } from "@/lib/agent/whatsapp-client";

describe("verifyWebhookSignature", () => {
  const originalSecret = process.env.WHATSAPP_APP_SECRET;

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  });

  afterEach(() => {
    process.env.WHATSAPP_APP_SECRET = originalSecret;
  });

  function signaturesFor(body: string): string {
    const hex = crypto.createHmac("sha256", "test-app-secret").update(body, "utf8").digest("hex");
    return `sha256=${hex}`;
  }

  it("returns true for a valid signature", () => {
    const body = '{"hello":"world"}';
    expect(verifyWebhookSignature(body, signaturesFor(body))).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const body = '{"hello":"world"}';
    expect(verifyWebhookSignature('{"hello":"tampered"}', signaturesFor(body))).toBe(false);
  });

  it("returns false when the header is missing", () => {
    expect(verifyWebhookSignature('{"a":1}', null)).toBe(false);
  });

  it("returns false when the header has the wrong scheme", () => {
    expect(verifyWebhookSignature('{"a":1}', "sha1=deadbeef")).toBe(false);
  });
});

describe("sendWhatsAppText", () => {
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  });

  afterEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;
    vi.unstubAllGlobals();
  });

  it("POSTs to the Graph API with the expected payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsAppText("+15551234567", "hello there");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v20.0/123456/messages");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: "whatsapp",
      to: "15551234567",
      type: "text",
      text: { body: "hello there" },
    });
  });

  it("throws when the Graph API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "invalid token" })
    );

    await expect(sendWhatsAppText("+15551234567", "hi")).rejects.toThrow(/401/);
  });
});
