import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion } from "@/lib/agent/claude-client";

// `generateReply` sudah dihapus — turn agen sekarang lewat `runToolLoop`
// (lihat tool-loop.test.ts). Yang diuji di sini khusus bagian tool-calling dari
// transport; dasar-dasar chatCompletion ada di chat-completion.test.ts.

afterEach(() => vi.unstubAllGlobals());

const base = { model: "gemini-2.0-flash-lite", apiKey: "test-key" };

function stubResponse(message: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message }] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("chatCompletion — tool calling", () => {
  it("omits the tools key entirely when no tools are passed", async () => {
    const fetchMock = stubResponse({ content: "halo" });
    await chatCompletion({ ...base, messages: [{ role: "user", content: "hi" }] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toBeUndefined();
  });

  it("omits the tools key when an empty array is passed", async () => {
    const fetchMock = stubResponse({ content: "halo" });
    await chatCompletion({ ...base, messages: [{ role: "user", content: "hi" }], tools: [] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toBeUndefined();
  });

  it("forwards tool definitions when given", async () => {
    const fetchMock = stubResponse({ content: "halo" });
    const tools = [{ type: "function", function: { name: "record_sale" } }];
    await chatCompletion({ ...base, messages: [{ role: "user", content: "hi" }], tools });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toEqual(tools);
  });

  it("returns an empty toolCalls array for a plain text reply", async () => {
    stubResponse({ content: "halo" });
    const res = await chatCompletion({ ...base, messages: [{ role: "user", content: "hi" }] });
    expect(res.toolCalls).toEqual([]);
  });

  it("parses tool calls into id / name / arguments", async () => {
    stubResponse({
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "record_sale", arguments: '{"items":[]}' },
        },
      ],
    });

    const res = await chatCompletion({ ...base, messages: [{ role: "user", content: "hi" }] });

    expect(res.toolCalls).toEqual([
      { id: "call_1", name: "record_sale", arguments: '{"items":[]}' },
    ]);
    expect(res.text).toBe("");
  });

  it("tolerates a malformed tool call instead of throwing", async () => {
    stubResponse({ content: null, tool_calls: [{ id: "call_1" }] });
    const res = await chatCompletion({ ...base, messages: [{ role: "user", content: "hi" }] });
    expect(res.toolCalls).toEqual([{ id: "call_1", name: "", arguments: "" }]);
  });
});
