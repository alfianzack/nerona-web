import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateReply } from "@/lib/agent/claude-client";

describe("generateReply", () => {
  const originalKey = process.env.SUMOPOD_API_KEY;

  beforeEach(() => {
    process.env.SUMOPOD_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.SUMOPOD_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("POSTs to the Sumopod chat completions endpoint and returns the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Halo! Ada yang bisa saya bantu?" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const reply = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(reply).toBe("Halo! Ada yang bisa saya bantu?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://ai.sumopod.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual(
      expect.objectContaining({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "halo" },
        ],
      })
    );
  });

  it("returns an empty string when the response has no content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) })
    );

    const reply = await generateReply({
      systemPrompt: "You are a helpful assistant.",
      history: [{ role: "user", content: "halo" }],
    });

    expect(reply).toBe("");
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
