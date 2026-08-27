import { resolveAiForUser } from "@/lib/ai-models";
import { chatCompletion } from "./claude-client";
import { SHOP_TOOLS, executeTool } from "./tools";
import type { AiPricing, TokenUsage } from "./pricing";

/**
 * Satu turn agen, termasuk pemakaian tool toko.
 *
 * Menggantikan `generateReply`: model boleh meminta tool, hasilnya dikembalikan ke
 * model, lalu diulang sampai model menjawab dengan teks. Setelah `MAX_TOOL_ROUNDS`
 * putaran, dilakukan satu panggilan tanpa `tools` supaya pemilik SELALU dapat
 * balasan, bukan diam.
 *
 * Setelan AI (model, key, tarif) dibaca SEKALI di awal, bukan tiap putaran —
 * dan tarifnya milik model yang berlaku bagi pemilik toko ini, sehingga seluruh
 * putaran ditagih pada tarif yang sama dengan tarif saat ia digenerate.
 */

const MAX_TOOL_ROUNDS = 5;

interface ChatMessage {
  role: string;
  content: unknown;
  [key: string]: unknown;
}

export interface ToolLoopResult {
  text: string;
  model: string;
  /** Jumlah token SELURUH putaran — dipotong sekali di akhir turn. */
  usage: TokenUsage | null;
  pricing: AiPricing;
  rounds: number;
}

export async function runToolLoop(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  userId: string;
  timezone: string;
}): Promise<ToolLoopResult> {
  const { modelId: model, apiKey, baseUrl, pricing } = await resolveAiForUser(params.userId);
  const ctx = { userId: params.userId, timezone: params.timezone };

  const messages: ChatMessage[] = [
    { role: "system", content: params.systemPrompt },
    ...params.history.map((entry) => ({ role: entry.role, content: entry.content })),
  ];

  let promptTokens = 0;
  let completionTokens = 0;
  let sawUsage = false;
  let rounds = 0;

  const call = (tools?: unknown[]) =>
    chatCompletion({ messages, model, apiKey, baseUrl, tools }).then((result) => {
      rounds += 1;
      if (result.usage) {
        sawUsage = true;
        promptTokens += result.usage.promptTokens;
        completionTokens += result.usage.completionTokens;
      }
      return result;
    });

  const finish = (text: string): ToolLoopResult => ({
    text,
    model,
    usage: sawUsage ? { promptTokens, completionTokens } : null,
    pricing,
    rounds,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await call(SHOP_TOOLS);

    if (result.toolCalls.length === 0) {
      return finish(result.text);
    }

    messages.push({
      role: "assistant",
      content: result.text || null,
      tool_calls: result.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const toolCall of result.toolCalls) {
      const output = await executeTool(ctx, toolCall.name, toolCall.arguments);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: output });
    }
  }

  // Anggaran putaran habis: satu panggilan tanpa tools supaya model merangkum.
  const final = await call();
  return finish(final.text);
}
