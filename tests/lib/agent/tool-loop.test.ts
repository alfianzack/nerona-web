import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-models", () => ({ resolveAiForUser: vi.fn() }));
vi.mock("@/lib/agent/tools", () => ({
  SHOP_TOOLS: [{ type: "function", function: { name: "record_sale" } }],
  executeTool: vi.fn(),
}));

import { runToolLoop } from "@/lib/agent/tool-loop";
import { resolveAiForUser } from "@/lib/ai-models";
import { executeTool } from "@/lib/agent/tools";

const PRICING = { inPerMTok: 0.075, outPerMTok: 0.3, pointsPerUsd: 100_000 };

/** Satu respons Sumopod: teks final, atau permintaan tool. */
function reply(opts: {
  content?: string | null;
  toolCalls?: { id: string; name: string; args: string }[];
  usage?: { prompt: number; completion: number } | null;
}) {
  const message: any = { content: opts.content ?? null };
  if (opts.toolCalls) {
    message.tool_calls = opts.toolCalls.map((c) => ({
      id: c.id,
      type: "function",
      function: { name: c.name, arguments: c.args },
    }));
  }
  return {
    ok: true,
    json: async () => ({
      choices: [{ message }],
      usage: opts.usage
        ? { prompt_tokens: opts.usage.prompt, completion_tokens: opts.usage.completion }
        : undefined,
    }),
  };
}

function stubFetchSequence(responses: unknown[]) {
  const fetchMock = vi.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  // Panggilan di luar urutan yang disiapkan tetap dapat teks, supaya kegagalan
  // terlihat sebagai jumlah panggilan yang salah, bukan sebagai crash.
  fetchMock.mockResolvedValue(reply({ content: "fallback" }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: any, index: number) {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

const params = {
  systemPrompt: "Anda adalah Nerona Agent.",
  history: [{ role: "user" as const, content: "catat 2 nasi goreng" }],
  userId: "user-1",
  timezone: "Asia/Jakarta",
};

beforeEach(() => {
  vi.clearAllMocks();
  (resolveAiForUser as any).mockResolvedValue({
    modelId: "gemini-2.0-flash-lite",
    apiKey: "test-key",
    pricing: PRICING,
  });
  (executeTool as any).mockResolvedValue('{"ok":true}');
});

afterEach(() => vi.unstubAllGlobals());

describe("runToolLoop", () => {
  it("returns the reply directly when the model asks for no tools", async () => {
    const fetchMock = stubFetchSequence([
      reply({ content: "Halo!", usage: { prompt: 100, completion: 20 } }),
    ]);

    const result = await runToolLoop(params);

    expect(result.text).toBe("Halo!");
    expect(result.rounds).toBe(1);
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 20 });
    expect(result.pricing).toEqual(PRICING);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("sends the system prompt, the history, and the tool definitions", async () => {
    const fetchMock = stubFetchSequence([reply({ content: "ok" })]);

    await runToolLoop(params);

    const body = bodyOf(fetchMock, 0);
    expect(body.messages).toEqual([
      { role: "system", content: "Anda adalah Nerona Agent." },
      { role: "user", content: "catat 2 nasi goreng" },
    ]);
    expect(body.tools).toHaveLength(1);
    expect(body.model).toBe("gemini-2.0-flash-lite");
  });

  it("executes a requested tool and feeds the result back for a final answer", async () => {
    const fetchMock = stubFetchSequence([
      reply({
        toolCalls: [{ id: "call_1", name: "record_sale", args: '{"items":[]}' }],
        usage: { prompt: 200, completion: 30 },
      }),
      reply({ content: "Tercatat: 2 Nasi Goreng, total Rp20.000.", usage: { prompt: 260, completion: 40 } }),
    ]);

    const result = await runToolLoop(params);

    expect(executeTool).toHaveBeenCalledWith(
      { userId: "user-1", timezone: "Asia/Jakarta" },
      "record_sale",
      '{"items":[]}'
    );
    expect(result.text).toBe("Tercatat: 2 Nasi Goreng, total Rp20.000.");
    expect(result.rounds).toBe(2);

    // Putaran kedua membawa jawaban tool: assistant(tool_calls) lalu role "tool".
    const second = bodyOf(fetchMock, 1);
    expect(second.messages[2]).toEqual(
      expect.objectContaining({ role: "assistant", tool_calls: expect.any(Array) })
    );
    expect(second.messages[3]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: '{"ok":true}',
    });
  });

  it("sums token usage across every round so the wallet is charged once for the whole turn", async () => {
    stubFetchSequence([
      reply({
        toolCalls: [{ id: "c1", name: "record_sale", args: "{}" }],
        usage: { prompt: 200, completion: 30 },
      }),
      reply({ content: "selesai", usage: { prompt: 260, completion: 40 } }),
    ]);

    const result = await runToolLoop(params);

    expect(result.usage).toEqual({ promptTokens: 460, completionTokens: 70 });
  });

  it("ignores rounds that report no usage instead of losing the rest", async () => {
    stubFetchSequence([
      reply({ toolCalls: [{ id: "c1", name: "record_sale", args: "{}" }], usage: null }),
      reply({ content: "selesai", usage: { prompt: 100, completion: 10 } }),
    ]);

    const result = await runToolLoop(params);

    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 10 });
  });

  it("runs several tool calls from one round, each answered by its own tool_call_id", async () => {
    (executeTool as any)
      .mockResolvedValueOnce('{"ok":true,"action":"created"}')
      .mockResolvedValueOnce('{"ok":true,"order":{}}');
    const fetchMock = stubFetchSequence([
      reply({
        toolCalls: [
          { id: "c1", name: "add_product", args: '{"name":"Nasi Goreng","price":10000}' },
          { id: "c2", name: "record_sale", args: '{"items":[]}' },
        ],
      }),
      reply({ content: "beres" }),
    ]);

    const result = await runToolLoop(params);

    expect(executeTool).toHaveBeenCalledTimes(2);
    const toolMessages = bodyOf(fetchMock, 1).messages.filter((m: any) => m.role === "tool");
    expect(toolMessages).toEqual([
      { role: "tool", tool_call_id: "c1", content: '{"ok":true,"action":"created"}' },
      { role: "tool", tool_call_id: "c2", content: '{"ok":true,"order":{}}' },
    ]);
    expect(result.text).toBe("beres");
  });

  it("makes one final call WITHOUT tools when the round budget runs out", async () => {
    const looping = Array.from({ length: 5 }, (_, i) =>
      reply({ toolCalls: [{ id: `c${i}`, name: "record_sale", args: "{}" }] })
    );
    const fetchMock = stubFetchSequence([
      ...looping,
      reply({ content: "Maaf, saya rangkum saja ya." }),
    ]);

    const result = await runToolLoop(params);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(bodyOf(fetchMock, 5).tools).toBeUndefined();
    expect(result.text).toBe("Maaf, saya rangkum saja ya.");
    expect(result.rounds).toBe(6);
  });

  it("propagates an upstream failure to the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "bad gateway" })
    );

    await expect(runToolLoop(params)).rejects.toThrow(/502/);
  });
});
