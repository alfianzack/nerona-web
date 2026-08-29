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

  it("calls the row's own gateway when one is given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) });
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletion({
      messages: [{ role: "user", content: "x" }],
      model: "claude-opus-5",
      apiKey: "row-key",
      baseUrl: "https://api.anthropic.example/v1",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.example/v1/chat/completions");
  });

  it("falls back to the shared gateway when no baseUrl is given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) });
    vi.stubGlobal("fetch", fetchMock);

    await chatCompletion({ messages: [{ role: "user", content: "x" }], model: "m", apiKey: "k" });

    expect(fetchMock.mock.calls[0][0]).toContain("sumopod");
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
