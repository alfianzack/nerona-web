import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));

import { generateReply } from "@/lib/agent/claude-client";
import { getAiSettings } from "@/lib/ai-settings";

describe("generateReply", () => {
  beforeEach(() => {
    (getAiSettings as any).mockResolvedValue({ model: "gemini-2.0-flash-lite", apiKey: "test-key" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the Sumopod chat completions endpoint and returns the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Halo! Ada yang bisa saya bantu?" } }],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(result.text).toBe("Halo! Ada yang bisa saya bantu?");
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 8 });
    expect(result.model).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.sumopod.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual(
      expect.objectContaining({
        model: "gemini-2.0-flash-lite",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "halo" },
        ],
      })
    );
    expect(result.model).toBe("gemini-2.0-flash-lite");
  });

  it("returns an empty string when the response has no content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) })
    );

    const result = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(result.text).toBe("");
    expect(result.usage).toBeNull();
  });

  it("throws when the API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "invalid key" })
    );

    await expect(
      generateReply({
        systemPrompt: "You are a helpful assistant.",
        history: [{ role: "user", content: "hi" }],
      })
    ).rejects.toThrow(/401/);
  });
});
