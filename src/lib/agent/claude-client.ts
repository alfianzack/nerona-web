// Transport HTTP ke Sumopod. Orkestrasi tool + resolusi setelan AI ada di
// `tool-loop.ts`; file ini sengaja tidak tahu apa-apa soal keduanya.
const BASE_URL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
  /** Kosong kalau model tidak meminta tool (atau `tools` tidak dikirim). */
  toolCalls: ToolCall[];
}

export async function chatCompletion(params: {
  messages: Array<{ role: string; content: unknown; [key: string]: unknown }>;
  model: string;
  apiKey: string;
  maxTokens?: number;
  /** Kalau kosong, kunci `tools` tidak dikirim sama sekali. */
  tools?: unknown[];
}): Promise<ChatCompletionResult> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      messages: params.messages,
      ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sumopod chat completion failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const text = message?.content ?? "";
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      }
    : null;
  const toolCalls: ToolCall[] = Array.isArray(message?.tool_calls)
    ? message.tool_calls.map((call: any) => ({
        id: String(call?.id ?? ""),
        name: String(call?.function?.name ?? ""),
        arguments: String(call?.function?.arguments ?? ""),
      }))
    : [];
  return { text, model: params.model, usage, toolCalls };
}
