import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: vi.fn() }));
// `pricing` is left REAL (it is pure) so the charge asserted below is the one the
// configured rates actually produce.
vi.mock("@/lib/points", () => ({ spendPoints: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn(() => ({ ok: true, remaining: 89, retryAfterSeconds: 0 })) }));
vi.mock("@/lib/extension-version", () => ({ tolakKalauBasi: vi.fn() }));
vi.mock("@/lib/extension/prompt-resolver", () => ({
  resolveMetadataPrompt: vi.fn(async () => ({ prompt: "P", maxTokens: 1234 })),
}));
vi.mock("@/lib/extension/prompts", () => ({
  buildMetadataPrompt: vi.fn(() => ({ prompt: "P", maxTokens: 1234 })),
  buildScoringPrompt: vi.fn(() => ({ prompt: "P", maxTokens: 1234 })),
  buildCommercialIntentPrompt: vi.fn(() => ({ prompt: "P", maxTokens: 1234 })),
  buildKeywordPrompt: vi.fn(() => ({ prompt: "P", maxTokens: 1234 })),
  buildRejectPrompt: vi.fn(() => ({ prompt: "P", maxTokens: 1234 })),
}));

import { POST } from "@/app/api/extension/generate/route";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";
import { spendPoints } from "@/lib/points";
import { hit } from "@/lib/rate-limit";
import { tolakKalauBasi } from "@/lib/extension-version";
import {
  buildMetadataPrompt,
  buildKeywordPrompt,
} from "@/lib/extension/prompts";
import { resolveMetadataPrompt } from "@/lib/extension/prompt-resolver";

function req(body: unknown, auth: string | null = "Bearer nrx_ok") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth) headers.authorization = auth;
  return new Request("http://test/api/extension/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const metadataBody = {
  feature: "metadata",
  marketplace: "adobe_stock",
  promptMode: "advanced",
  batchIndex: 0,
  image: { mime: "image/png", dataBase64: "abc123" },
};

const keywordBody = {
  feature: "keyword",
  marketplace: "adobe_stock",
  monthsCurrent: "August",
  monthsNext: "September",
  referenceDate: "2026-07-24",
};

beforeEach(() => {
  vi.clearAllMocks();
  (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
  (hit as any).mockReturnValue({ ok: true, remaining: 89, retryAfterSeconds: 0 });
  (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 100 });
  (getAiSettings as any).mockResolvedValue({
    model: "gemini-2.0-flash",
    apiKey: "adminkey",
    pricing: { inPerMTok: 0.1, outPerMTok: 0.4, pointsPerUsd: 100_000 },
  });
  (chatCompletion as any).mockResolvedValue({
    text: "meta",
    model: "gemini-2.0-flash",
    usage: { promptTokens: 1200, completionTokens: 150 },
  });
  (spendPoints as any).mockResolvedValue(95);
  // Bawaan: tidak ada gerbang versi. Yang menentukan siapa tertahan diuji di
  // tests/lib/extension-version.test.ts; di sini yang diuji apa yang dilakukan
  // rute ini saat gerbangnya menahan.
  (tolakKalauBasi as any).mockResolvedValue(null);
  (buildMetadataPrompt as any).mockReturnValue({ prompt: "P", maxTokens: 1234 });
  (buildKeywordPrompt as any).mockReturnValue({ prompt: "P", maxTokens: 1234 });
});

describe("POST /api/extension/generate", () => {
  it("401 without/with invalid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue(null);
    expect((await POST(req(metadataBody, null))).status).toBe(401);
    expect((await POST(req(metadataBody))).status).toBe(401);
  });

  it("429 when rate-limited", async () => {
    (hit as any).mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 30 });
    const res = await POST(req(metadataBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("403 when license inactive", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: false, pointsBalance: 100 });
    expect((await POST(req(metadataBody))).status).toBe(403);
  });

  it("402 when no points", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 0 });
    expect((await POST(req(metadataBody))).status).toBe(402);
  });

  it("403 outdated berisi cara keluarnya, dan tidak membakar apa pun", async () => {
    (tolakKalauBasi as any).mockResolvedValue({
      latest: "1.2.0", min: "1.1.0", url: "https://nerona-web.vercel.app/unduh",
    });
    const res = await POST(req(metadataBody));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false, error: "outdated",
      latest: "1.2.0", min: "1.1.0", url: "https://nerona-web.vercel.app/unduh",
    });
    expect(chatCompletion).not.toHaveBeenCalled();
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("versi basi didahulukan atas poin habis", async () => {
    // "Poin habis" mengirim pengguna membeli poin untuk masalah yang bukan poin.
    (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 0 });
    (tolakKalauBasi as any).mockResolvedValue({ latest: "1.2.0", min: "1.1.0", url: "https://x/unduh" });
    const res = await POST(req(metadataBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("outdated");
  });

  it("400 on unknown feature", async () => {
    const res = await POST(req({ ...metadataBody, feature: "not_a_real_feature" }));
    expect(res.status).toBe(400);
  });

  it("200 metadata happy path: builder called, image message sent, spendPoints called", async () => {
    const res = await POST(req(metadataBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      content: "meta",
      usage: { promptTokens: 1200, completionTokens: 150 },
      pointsBalance: 95,
    });

    // Lewat resolver, bukan builder telanjang: preset tenant hanya bisa
    // ditemukan kalau userId dari token ikut dibawa.
    expect(resolveMetadataPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        marketplace: "adobe_stock",
        promptMode: "advanced",
        batchIndex: 0,
      })
    );
    expect(buildMetadataPrompt).not.toHaveBeenCalled();

    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.0-flash",
        apiKey: "adminkey",
        maxTokens: 1234,
      })
    );
    const call = (chatCompletion as any).mock.calls[0][0];
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe("user");
    expect(Array.isArray(call.messages[0].content)).toBe(true);
    const parts = call.messages[0].content;
    expect(parts.find((p: any) => p.type === "text").text).toBe("P");
    const imagePart = parts.find((p: any) => p.type === "image_url");
    expect(imagePart.image_url.url).toBe("data:image/png;base64,abc123");

    // 1200/1e6*0.10 + 150/1e6*0.40 = 0.00018 USD × 100000 = 18 poin
    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", cost: 18 }));
  });

  it("leaves the four other features on the Nerona prompts", async () => {
    await POST(req(keywordBody));
    expect(resolveMetadataPrompt).not.toHaveBeenCalled();
    expect(buildKeywordPrompt).toHaveBeenCalled();
  });

  it("charges at the rates configured in admin settings", async () => {
    (getAiSettings as any).mockResolvedValue({
      model: "gemini-2.0-flash",
      apiKey: "adminkey",
      pricing: { inPerMTok: 3, outPerMTok: 15, pointsPerUsd: 100_000 },
    });

    await POST(req(metadataBody));

    // 1200/1e6*3 + 150/1e6*15 = 0.00585 USD × 100000 = 585 poin
    expect(spendPoints).toHaveBeenCalledWith(expect.objectContaining({ cost: 585 }));
  });

  it("200 keyword path: text-only messages, no image_url", async () => {
    const res = await POST(req(keywordBody));
    expect(res.status).toBe(200);
    expect(buildKeywordPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "adobe_stock",
        monthsCurrent: "August",
        monthsNext: "September",
        referenceDate: "2026-07-24",
      })
    );
    const call = (chatCompletion as any).mock.calls[0][0];
    expect(call.messages).toEqual([{ role: "user", content: "P" }]);
  });

  it("413 when the image data exceeds the cap", async () => {
    const oversized = { ...metadataBody, image: { mime: "image/png", dataBase64: "x".repeat(12_000_001) } };
    const res = await POST(req(oversized));
    expect(res.status).toBe(413);
    expect(chatCompletion).not.toHaveBeenCalled();
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("502 and no spend when chatCompletion throws", async () => {
    (chatCompletion as any).mockRejectedValue(new Error("upstream"));
    const res = await POST(req(metadataBody));
    expect(res.status).toBe(502);
    expect(spendPoints).not.toHaveBeenCalled();
  });
});
