import { prisma } from "@/lib/prisma";

export interface AiSettings {
  model: string;
  apiKey: string;
}

const KEY_MODEL = "ai_model";
const KEY_API = "ai_api_key";

function defaultModel(): string {
  return process.env.AGENT_MODEL || "gemini-2.0-flash-lite";
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [KEY_MODEL, KEY_API] } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getAiSettings(): Promise<AiSettings> {
  const map = await readRows();
  const model = (map.get(KEY_MODEL) || "").trim() || defaultModel();
  const apiKey = (map.get(KEY_API) || "").trim() || process.env.SUMOPOD_API_KEY || "";
  return { model, apiKey };
}

export async function updateAiSettings(values: { model: string; apiKey?: string }): Promise<void> {
  const modelValue = (values.model ?? "").trim();
  const ops = [
    prisma.setting.upsert({
      where: { key: KEY_MODEL },
      create: { key: KEY_MODEL, value: modelValue },
      update: { value: modelValue },
    }),
  ];
  const apiKey = (values.apiKey ?? "").trim();
  if (apiKey) {
    ops.push(
      prisma.setting.upsert({
        where: { key: KEY_API },
        create: { key: KEY_API, value: apiKey },
        update: { value: apiKey },
      })
    );
  }
  await prisma.$transaction(ops);
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export async function getAiSettingsView(): Promise<{
  model: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
}> {
  const map = await readRows();
  const model = (map.get(KEY_MODEL) || "").trim(); // raw; "" when unset
  const effectiveKey = (map.get(KEY_API) || "").trim() || process.env.SUMOPOD_API_KEY || "";
  return { model, apiKeyMasked: maskKey(effectiveKey), apiKeySet: Boolean(effectiveKey) };
}
