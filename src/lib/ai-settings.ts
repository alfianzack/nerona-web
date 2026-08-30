import { prisma } from "@/lib/prisma";
import { DEFAULT_AI_PRICING, type AiPricing } from "@/lib/agent/pricing";

export type { AiPricing };

/**
 * Kunci gateway TIDAK ada di sini. Ia tinggal di tabel AiProvider sejak migrasi
 * 20260830000000_ai_providers — satu tempat, supaya kunci yang sama tidak pernah
 * ditempel dua kali lalu diputar di satu tempat saja.
 */
export interface AiSettings {
  model: string;
  pricing: AiPricing;
}

const KEY_MODEL = "ai_model";
const KEY_PRICE_IN = "ai_price_in";
const KEY_PRICE_OUT = "ai_price_out";
const KEY_POINTS_PER_USD = "points_per_usd";

const ALL_KEYS = [KEY_MODEL, KEY_PRICE_IN, KEY_PRICE_OUT, KEY_POINTS_PER_USD];

function defaultModel(): string {
  return process.env.AGENT_MODEL || "gemini-2.0-flash-lite";
}

/**
 * A rate is only honoured when it is a finite, non-negative number. Anything else —
 * blank, "gratis", "-2" — is treated as unset so the next source in the chain
 * (env, then the code default) applies. Zero is a legitimate rate (a free model); a
 * call still costs the 1-point floor.
 */
function parseRate(...candidates: (string | undefined)[]): number | null {
  for (const candidate of candidates) {
    const raw = (candidate ?? "").trim();
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Points-per-USD must be positive: zero would make every call free. */
function parsePointsPerUsd(...candidates: (string | undefined)[]): number | null {
  const n = parseRate(...candidates);
  return n !== null && n > 0 ? n : null;
}

function resolvePricing(map: Map<string, string>): AiPricing {
  return {
    inPerMTok: parseRate(map.get(KEY_PRICE_IN), process.env.AI_PRICE_IN) ?? DEFAULT_AI_PRICING.inPerMTok,
    outPerMTok:
      parseRate(map.get(KEY_PRICE_OUT), process.env.AI_PRICE_OUT) ?? DEFAULT_AI_PRICING.outPerMTok,
    pointsPerUsd:
      parsePointsPerUsd(map.get(KEY_POINTS_PER_USD), process.env.POINTS_PER_USD) ??
      DEFAULT_AI_PRICING.pointsPerUsd,
  };
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ALL_KEYS } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getAiSettings(): Promise<AiSettings> {
  const map = await readRows();
  const model = (map.get(KEY_MODEL) || "").trim() || defaultModel();
  return { model, pricing: resolvePricing(map) };
}

export interface UpdateAiSettingsInput {
  model: string;
  /** Omit to leave untouched; pass "" to clear back to the env/default fallback. */
  priceIn?: string;
  priceOut?: string;
  pointsPerUsd?: string;
}

export async function updateAiSettings(values: UpdateAiSettingsInput): Promise<void> {
  const upsert = (key: string, value: string) =>
    prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });

  const modelValue = (values.model ?? "").trim();
  const ops = [upsert(KEY_MODEL, modelValue)];

  // Order matters only for readability; each rate is written when it is present at
  // all, so "" is a deliberate clear rather than a no-op.
  const rates: [string, string | undefined][] = [
    [KEY_PRICE_IN, values.priceIn],
    [KEY_PRICE_OUT, values.priceOut],
    [KEY_POINTS_PER_USD, values.pointsPerUsd],
  ];
  for (const [key, value] of rates) {
    if (value !== undefined) ops.push(upsert(key, value.trim()));
  }

  await prisma.$transaction(ops);
}

export interface AiSettingsView {
  model: string;
  /** Raw stored values — "" when unset, so the panel can show a placeholder. */
  priceIn: string;
  priceOut: string;
  pointsPerUsd: string;
  /** What is actually in force right now, after the DB → env → default chain. */
  effective: AiPricing;
}

export async function getAiSettingsView(): Promise<AiSettingsView> {
  const map = await readRows();
  const model = (map.get(KEY_MODEL) || "").trim(); // raw; "" when unset
  return {
    model,
    priceIn: (map.get(KEY_PRICE_IN) || "").trim(),
    priceOut: (map.get(KEY_PRICE_OUT) || "").trim(),
    pointsPerUsd: (map.get(KEY_POINTS_PER_USD) || "").trim(),
    effective: resolvePricing(map),
  };
}
