import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));
vi.mock("@/lib/agent/claude-client", () => ({ chatCompletion: vi.fn() }));

import { testAiConnection } from "@/lib/ai-connection-test";
import { getAiSettings } from "@/lib/ai-settings";
import { chatCompletion } from "@/lib/agent/claude-client";

describe("testAiConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAiSettings as any).mockResolvedValue({ model: "gpt-5-nano", apiKey: "sk-test" });
    (chatCompletion as any).mockResolvedValue({
      text: "ok",
      model: "gpt-5-nano",
      usage: { promptTokens: 5, completionTokens: 1 },
    });
  });

  it("reports not configured when no API key is set", async () => {
    (getAiSettings as any).mockResolvedValue({ model: "gpt-5-nano", apiKey: "" });

    const result = await testAiConnection();

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it("passes when both the text and vision probes succeed", async () => {
    const result = await testAiConnection();

    expect(result.ok).toBe(true);
    expect(result.text.ok).toBe(true);
    expect(result.vision.ok).toBe(true);
    expect(result.model).toBe("gpt-5-nano");
    expect(chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("sends an image on the vision probe and none on the text probe", async () => {
    await testAiConnection();

    const [textCall, visionCall] = (chatCompletion as any).mock.calls;
    expect(JSON.stringify(textCall[0].messages)).not.toContain("image_url");
    expect(JSON.stringify(visionCall[0].messages)).toContain("image_url");
  });

  it("skips the vision probe when the key or model is already rejected", async () => {
    (chatCompletion as any).mockRejectedValue(new Error("401 invalid api key"));

    const result = await testAiConnection();

    expect(result.ok).toBe(false);
    expect(result.text.ok).toBe(false);
    expect(result.text.error).toContain("401");
    expect(result.vision.ok).toBe(false);
    expect(result.vision.skipped).toBe(true);
    expect(chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("flags a working key whose model cannot read images", async () => {
    (chatCompletion as any)
      .mockResolvedValueOnce({ text: "ok", model: "m", usage: null })
      .mockRejectedValueOnce(new Error("400 this model does not support image input"));

    const result = await testAiConnection();

    expect(result.ok).toBe(false);
    expect(result.text.ok).toBe(true);
    expect(result.vision.ok).toBe(false);
    expect(result.vision.error).toContain("image");
  });

  it("never echoes the API key in its result", async () => {
    (chatCompletion as any).mockRejectedValue(new Error("bad key sk-test rejected"));

    const result = await testAiConnection();

    expect(JSON.stringify(result)).not.toContain("sk-test");
  });
});
