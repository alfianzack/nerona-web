import { getAiSettings } from "@/lib/ai-settings";

const BASE_URL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";

export interface GenerateReplyResult {
  text: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

export async function generateReply(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<GenerateReplyResult> {
  const { model, apiKey } = await getAiSettings();

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
  return { text, model, usage };
}
