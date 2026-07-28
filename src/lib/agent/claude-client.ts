import { getAiSettings } from "@/lib/ai-settings";
import type { AiPricing } from "@/lib/agent/pricing";

const BASE_URL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";

export interface GenerateReplyResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
  /** The rates this call was made under — returned so the caller meters at the same
   *  rates without a second settings read. */
  pricing: AiPricing;
}

export async function generateReply(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<GenerateReplyResult> {
  const { model, apiKey, pricing } = await getAiSettings();

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "system", content: params.systemPrompt }, ...params.history],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sumopod chat completion failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      }
    : null;
  return { text, model, usage, pricing };
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export async function chatCompletion(params: {
  messages: Array<{ role: string; content: unknown }>;
  model: string;
  apiKey: string;
  maxTokens?: number;
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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sumopod chat completion failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      }
    : null;
  return { text, model: params.model, usage };
}
