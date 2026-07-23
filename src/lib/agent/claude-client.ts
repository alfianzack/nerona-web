const MODEL = process.env.AGENT_MODEL || "claude-sonnet-4-6";
const BASE_URL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";

export async function generateReply(params: {
  systemPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const apiKey = process.env.SUMOPOD_API_KEY;

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "system", content: params.systemPrompt }, ...params.history],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Sumopod chat completion failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
