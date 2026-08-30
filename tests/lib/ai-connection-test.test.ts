import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: vi.fn() }));

import { testAiConnection } from "@/lib/ai-connection-test";
import { chatCompletion } from "@/lib/agent/claude-client";

const chatCompletionMock = chatCompletion as any;

describe("testAiConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatCompletionMock.mockResolvedValue({
      text: "ok",
      model: "m",
      usage: { promptTokens: 5, completionTokens: 1 },
    });
  });

  it("reports not configured when no API key is set", async () => {
    const result = await testAiConnection({ apiKey: "", baseUrl: "https://a", model: "m" });

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("passes when both the text and vision probes succeed", async () => {
    const result = await testAiConnection({ apiKey: "k", baseUrl: "https://a", model: "m" });

    expect(result.ok).toBe(true);
    expect(result.text.ok).toBe(true);
    expect(result.vision.ok).toBe(true);
    expect(result.model).toBe("m");
    expect(chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("sends an image on the vision probe and none on the text probe", async () => {
    await testAiConnection({ apiKey: "k", baseUrl: "https://a", model: "m" });

    const [textCall, visionCall] = chatCompletionMock.mock.calls;
    expect(JSON.stringify(textCall[0].messages)).not.toContain("image_url");
    expect(JSON.stringify(visionCall[0].messages)).toContain("image_url");
  });

  it("skips the vision probe when the key or model is already rejected", async () => {
    chatCompletionMock.mockRejectedValue(new Error("401 invalid api key"));

    const result = await testAiConnection({ apiKey: "k", baseUrl: "https://a", model: "m" });

    expect(result.ok).toBe(false);
    expect(result.text.ok).toBe(false);
    expect(result.text.error).toContain("401");
    expect(result.vision.ok).toBe(false);
    expect(result.vision.skipped).toBe(true);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("flags a working key whose model cannot read images", async () => {
    chatCompletionMock
      .mockResolvedValueOnce({ text: "ok", model: "m", usage: null })
      .mockRejectedValueOnce(new Error("400 this model does not support image input"));

    const result = await testAiConnection({ apiKey: "k", baseUrl: "https://a", model: "m" });

    expect(result.ok).toBe(false);
    expect(result.text.ok).toBe(true);
    expect(result.vision.ok).toBe(false);
    expect(result.vision.error).toContain("image");
  });

  it("never echoes the API key in its result", async () => {
    chatCompletionMock.mockRejectedValue(new Error("bad key sk-test rejected"));

    const result = await testAiConnection({ apiKey: "sk-test", baseUrl: "https://a", model: "m" });

    expect(JSON.stringify(result)).not.toContain("sk-test");
  });

  it("meneruskan baseUrl provider ke setiap probe", async () => {
    chatCompletionMock.mockResolvedValue({ text: "ok" });
    await testAiConnection({ apiKey: "k", baseUrl: "https://a.example/v1", model: "m" });
    for (const call of chatCompletionMock.mock.calls) {
      expect(call[0].baseUrl).toBe("https://a.example/v1");
    }
  });

  it("tidak menjalankan probe gambar saat probe teks gagal — sebabnya sama", async () => {
    chatCompletionMock.mockRejectedValue(new Error("401 unauthorized"));
    const result = await testAiConnection({ apiKey: "k", baseUrl: "https://a", model: "m" });
    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
    expect(result.vision.skipped).toBe(true);
  });

  it("menyensor kunci yang terbawa di pesan galat hulu", async () => {
    chatCompletionMock.mockRejectedValue(new Error("bad key sk-rahasia123 ditolak"));
    const result = await testAiConnection({ apiKey: "sk-rahasia123", baseUrl: "https://a", model: "m" });
    expect(result.text.error).not.toContain("sk-rahasia123");
  });
});
