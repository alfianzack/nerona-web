import { prisma } from "@/lib/prisma";
import { normalizePlan } from "@/lib/plan-points";
import { parseRupiahInput } from "@/lib/money";

/**
 * Harga BULANAN paket Agent, dalam rupiah.
 *
 * Paket Metadata punya baris sendiri di tabel `Plan`, jadi harganya tersimpan di
 * kolom `priceMonthly`. Paket Agent tidak punya tabel — nama & batasnya hidup di
 * kode (`AGENT_PLAN_LIMITS`) — jadi harganya disimpan di Setting dengan rantai
 * yang sama seperti setelan lain: DB → env → default kode.
 *
 * Angka, bukan label: harga 3/6/12 bulan dihitung dari sini (lihat
 * lib/plan-duration.ts), dan teks tidak bisa dikalikan.
 */
export const DEFAULT_AGENT_MONTHLY_PRICES: Record<string, number> = {
  free: 0,
  pro: 49_000,
  business: 99_000,
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

/** Satu key datar per paket, senada dengan points_plan_agent_*. */
export function agentPriceSettingKey(plan: string): string {
  return `price_plan_agent_${normalizePlan(plan)}`;
}

function envKey(plan: string): string {
  return `PRICE_PLAN_AGENT_${normalizePlan(plan).toUpperCase()}`;
}

/**
 * Harga sah hanya kalau bilangan bulat >= 0. Kosong dan non-angka dianggap
 * belum diatur supaya sumber berikutnya dipakai; nol itu sah (paket gratis).
 */
function parsePrice(raw: string | undefined): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** null = paket tidak dikenal, tampilkan "Hubungi kami" — jangan mengarang harga. */
export async function agentMonthlyPrice(plan: string): Promise<number | null> {
  const key = normalizePlan(plan);
  const fallback = DEFAULT_AGENT_MONTHLY_PRICES[key];
  if (fallback === undefined) return null;

  const row = await prisma.setting.findUnique({ where: { key: agentPriceSettingKey(key) } });
  return parsePrice(row?.value) ?? parsePrice(process.env[envKey(key)]) ?? fallback;
}

export interface AgentPriceRow {
  plan: string;
  label: string;
  /** Nilai mentah tersimpan — "" saat belum diatur, supaya panel bisa memberi placeholder. */
  stored: string;
  /** Yang benar-benar berlaku setelah DB → env → default. */
  effective: number;
  /** Jumlah akun agent yang memakai paket ini, sebagai padanan "lisensi aktif". */
  activeProfiles: number;
}

export async function getAgentPricingView(): Promise<AgentPriceRow[]> {
  const plans = Object.keys(DEFAULT_AGENT_MONTHLY_PRICES);
  const [rows, grouped] = await Promise.all([
    prisma.setting.findMany({ where: { key: { in: plans.map(agentPriceSettingKey) } } }),
    prisma.agentProfile.groupBy({
      by: ["plan"],
      where: { status: "active" },
      _count: { _all: true },
    }),
  ]);
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const counts = new Map(grouped.map((g) => [normalizePlan(g.plan), g._count._all]));

  return plans.map((plan) => {
    const raw = stored.get(agentPriceSettingKey(plan)) ?? "";
    return {
      plan,
      label: PLAN_LABELS[plan] ?? plan,
      stored: raw.trim(),
      effective:
        parsePrice(raw) ?? parsePrice(process.env[envKey(plan)]) ?? DEFAULT_AGENT_MONTHLY_PRICES[plan],
      activeProfiles: counts.get(plan) ?? 0,
    };
  });
}

export type UpdateAgentPriceResult = { ok: true } | { ok: false; reason: "not_found" | "invalid" };

export async function updateAgentPrice(plan: string, price: string): Promise<UpdateAgentPriceResult> {
  const key = normalizePlan(plan);
  // Pemanggil tidak boleh mengarang paket baru lewat POST.
  if (DEFAULT_AGENT_MONTHLY_PRICES[key] === undefined) return { ok: false, reason: "not_found" };

  // Dinormalkan sebelum disimpan, bukan disimpan mentah: "Rp 59.000" yang
  // tersimpan apa adanya akan gagal dibaca kembali dan diam-diam jatuh ke harga
  // bawaan — owner melihat "Tersimpan ✓" untuk harga yang tidak pernah berlaku.
  const parsed = parseRupiahInput(price);
  if (parsed === undefined) return { ok: false, reason: "invalid" };

  const settingKey = agentPriceSettingKey(key);
  const value = parsed === null ? "" : String(parsed);
  await prisma.setting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value },
    update: { value },
  });
  return { ok: true };
}
