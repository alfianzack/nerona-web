import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { active: true, pointsBalance: 100 };
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn(async () => state) }));
vi.mock("@/lib/ai-models", () => ({ resolveAiForTrial: vi.fn() }));
vi.mock("@/lib/extension/prompt-resolver", () => ({ resolveTrialPrompt: vi.fn() }));
vi.mock("@/lib/extension/panggilan-berbayar", () => ({ panggilAiBerbayar: vi.fn() }));

import { jalankanCobaPrompt } from "@/lib/prompt-coba";

const GAMBAR = { mime: "image/jpeg", dataBase64: "AAAA" };

describe("jalankanCobaPrompt", () => {
  beforeEach(() => { state.active = true; state.pointsBalance = 100; });

  it("paket mati: 403", async () => {
    state.active = false;
    const r = await jalankanCobaPrompt("u-mati", { marketplace: "adobe", image: GAMBAR });
    expect(r.status).toBe(403);
  });
  it("saldo nol: 402", async () => {
    state.pointsBalance = 0;
    expect((await jalankanCobaPrompt("u-nol", { marketplace: "adobe", image: GAMBAR })).status).toBe(402);
  });
  it("marketplace atau gambar tidak sah: 400", async () => {
    expect((await jalankanCobaPrompt("u-a", { marketplace: "tidak-ada", image: GAMBAR })).status).toBe(400);
    expect((await jalankanCobaPrompt("u-b", { marketplace: "adobe", image: { mime: "image/svg+xml", dataBase64: "A" } })).status).toBe(400);
  });
  it("lebih dari 10 per menit per pengguna: 429 dengan Retry-After", async () => {
    let r;
    for (let i = 0; i < 11; i++) r = await jalankanCobaPrompt("u-laju", { marketplace: "x", image: GAMBAR });
    expect(r!.status).toBe(429);
    expect(r!.headers?.["Retry-After"]).toBeTruthy();
  });
});
