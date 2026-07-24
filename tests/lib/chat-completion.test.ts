import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion } from "@/lib/agent/claude-client";

afterEach(() => vi.unstubAllGlobals());

describe("chatCompletion", () => {
  it("POSTs messages + model + bearer and returns text/usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "hasil metadata" } }],
        usage: { prompt_tokens: 1200, completion_tokens: 150 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const msgs = [{ role: "user", content: [{ type: "text", text: "hi" }] }];
    const res = await chatCompletion({ messages: msgs, model: "gemini-2.0-flash", apiKey: "k1", maxTokens: 512 });

    expect(res.text).toBe("hasil metadata");
    expect(res.model).toBe("gemini-2.0-flash");
    expect(res.usage).toEqual({ promptTokens: 1200, completionTokens: 150 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k1");
    const body = JSON.parse(init.body);
    expect(body).toEqual(expect.objectContaining({ model: "gemini-2.0-flash", max_tokens: 512, messages: msgs }));
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }));
    await expect(
      chatCompletion({ messages: [{ role: "user", content: "x" }], model: "m", apiKey: "k" })
    ).rejects.toThrow(/500/);
  });

  it("returns null usage when absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) }));
    const res = await chatCompletion({ messages: [{ role: "user", content: "x" }], model: "m", apiKey: "k" });
    expect(res.text).toBe("");
    expect(res.usage).toBeNull();
  });
});
