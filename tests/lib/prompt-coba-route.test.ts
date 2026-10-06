import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/ai-models", async (asli) => ({
  ...(await asli<typeof import("@/lib/ai-models")>()),
  resolveAiForTrial: vi.fn(),
}));
vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: vi.fn() }));
vi.mock("@/lib/points", () => ({ spendPoints: vi.fn() }));
vi.mock("@/lib/ai-usage", () => ({ recordAiUsage: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn() }));
vi.mock("@/lib/extension/prompt-resolver", () => ({ resolveTrialPrompt: vi.fn() }));

import { POST } from "@/app/api/prompts/coba/route";
import { getServerSession } from "next-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { AiModelError, resolveAiForTrial } from "@/lib/ai-models";
import { chatCompletion } from "@/lib/agent/claude-client";
import { spendPoints } from "@/lib/points";
import { recordAiUsage } from "@/lib/ai-usage";
import { hit } from "@/lib/rate-limit";
import { resolveTrialPrompt } from "@/lib/extension/prompt-resolver";

const JSON_OK = '{"title":"Green hills at sunset","description":"Flat vector hills.","keywords":["hills","sunset"]}';
const PROMPT_RAHASIA = "PROMPT NERONA RAHASIA";

function req(body: unknown) {
  return new Request("http://test/api/prompts/coba", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const badan = {
  body: "Kamu penulis metadata.",
  marketplace: "adobe",
  aiModelId: "m2",
  image: { mime: "image/jpeg", dataBase64: "abc123" },
};

beforeEach(() => {
  vi.clearAllMocks();
  (getServerSession as any).mockResolvedValue({ user: { id: "u1" } });
  (hit as any).mockReturnValue({ ok: true, remaining: 9, retryAfterSeconds: 0 });
  (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 100 });
  (resolveTrialPrompt as any).mockResolvedValue({ prompt: PROMPT_RAHASIA, maxTokens: 4000 });
  (resolveAiForTrial as any).mockResolvedValue({
    aiModelId: "m2",
    modelId: "gpt-5",
    label: "GPT 5",
    apiKey: "k",
    baseUrl: "https://a.example/v1",
    pricing: { inPerMTok: 1, outPerMTok: 10, pointsPerUsd: 1_000 },
  });
  (chatCompletion as any).mockResolvedValue({
    text: JSON_OK,
    finishReason: "stop",
    usage: { promptTokens: 1000, completionTokens: 200 },
  });
  (spendPoints as any).mockResolvedValue(97);
});

describe("POST /api/prompts/coba", () => {
  it("401 tanpa sesi", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(req(badan))).status).toBe(401);
  });

  it("429 saat kena batas", async () => {
    (hit as any).mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 20 });
    expect((await POST(req(badan))).status).toBe(429);
  });

  it("403 akun tidak aktif, 402 poin habis, keduanya tanpa panggilan AI", async () => {
    (getExtensionAccountState as any).mockResolvedValue({ active: false, pointsBalance: 100 });
    expect((await POST(req(badan))).status).toBe(403);
    (getExtensionAccountState as any).mockResolvedValue({ active: true, pointsBalance: 0 });
    expect((await POST(req(badan))).status).toBe(402);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("400 untuk marketplace asing, gambar hilang, jenis gambar asing, atau teks terlalu panjang", async () => {
    for (const salah of [
      { ...badan, marketplace: "etsy" },
      { ...badan, image: undefined },
      { ...badan, image: { mime: "image/svg+xml", dataBase64: "abc" } },
      { ...badan, body: "x".repeat(6_001) },
    ]) {
      expect((await POST(req(salah))).status).toBe(400);
    }
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("merakit prompt dari teks editor dan label marketplace, lalu memanggil model pilihan", async () => {
    const res = await POST(req(badan));
    expect(res.status).toBe(200);
    expect(resolveTrialPrompt).toHaveBeenCalledWith({
      userId: "u1",
      marketplace: "Adobe Stock",
      body: "Kamu penulis metadata.",
    });
    expect(resolveAiForTrial).toHaveBeenCalledWith("u1", "m2");
    const panggil = (chatCompletion as any).mock.calls[0][0];
    expect(panggil.model).toBe("gpt-5");
    expect(panggil.maxTokens).toBe(4000);
    expect(panggil.messages[0].content[1].image_url.url).toBe("data:image/jpeg;base64,abc123");
  });

  it("menagih dengan tarif model pilihan dan mengembalikan metadata terurai tanpa prompt", async () => {
    const res = await POST(req(badan));
    const data = await res.json();
    // 1000 x 1/1e6 + 200 x 10/1e6 = 0.003 USD x 1000 = 3 poin
    expect(spendPoints).toHaveBeenCalledWith({ userId: "u1", cost: 3, note: "Uji prompt" });
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", aiModelId: "m2", feature: "metadata_uji", withImage: true, points: 3 })
    );
    expect(data).toEqual({
      ok: true,
      title: "Green hills at sunset",
      description: "Flat vector hills.",
      keywords: ["hills", "sunset"],
      model: { id: "m2", label: "GPT 5" },
      pointsCharged: 3,
      pointsBalance: 97,
    });
    expect(JSON.stringify(data)).not.toContain(PROMPT_RAHASIA);
  });

  it("tanpa aiModelId memakai model tersimpan", async () => {
    await POST(req({ ...badan, aiModelId: undefined }));
    expect(resolveAiForTrial).toHaveBeenCalledWith("u1", null);
  });

  it("model yang ditolak penjaga jadi galat terbaca, tanpa panggilan AI", async () => {
    (resolveAiForTrial as any).mockRejectedValue(new AiModelError("plan_not_allowed"));
    const res = await POST(req(badan));
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/paket/);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("balasan kosong atau terpotong tidak memotong poin", async () => {
    (chatCompletion as any).mockResolvedValueOnce({ text: " ", finishReason: "stop", usage: {} });
    expect((await POST(req(badan))).status).toBe(502);
    (chatCompletion as any).mockResolvedValueOnce({ text: '{"title":', finishReason: "length", usage: {} });
    expect((await POST(req(badan))).status).toBe(502);
    expect(spendPoints).not.toHaveBeenCalled();
  });

  it("balasan bukan JSON tetap menagih (model sudah bekerja) dan menyebut poinnya", async () => {
    (chatCompletion as any).mockResolvedValue({
      text: "Here is some prose.",
      finishReason: "stop",
      usage: { promptTokens: 1000, completionTokens: 200 },
    });
    const res = await POST(req(badan));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data).toMatchObject({ ok: false, error: "ai_unparsed", pointsCharged: 3, pointsBalance: 97 });
    expect(spendPoints).toHaveBeenCalledOnce();
  });
});
