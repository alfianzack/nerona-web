import { afterEach, describe, expect, it, vi } from "vitest";

import { loadAiModelsPanelData } from "@/components/admin/AdminAiModelsPanel";

afterEach(() => {
  vi.unstubAllGlobals();
});

const MODELS_OK = { ok: true, models: [{ id: "m1", label: "Claude Opus 5" }] };
const AI_OK = { ok: true, settings: { effective: { pointsPerUsd: 1_000 } } };
const PROVIDERS_OK = { ok: true, providers: [{ id: "p1", label: "SumoPod", isDefault: true }] };

function stubFetch(byUrl: Record<string, { ok: boolean; body: unknown }>) {
  const fetchMock = vi.fn((url: string) => {
    const entry = byUrl[url];
    return Promise.resolve({
      ok: entry.ok,
      json: async () => entry.body,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Provider gagal dimuat harus terbaca sebagai kegagalan, bukan sebagai daftar
 * provider yang kosong — daftar kosong palsu itu yang membuat badge model
 * bilang "Provider terhapus" dan formulir Sunting kehilangan pilihannya
 * padahal providernya baik-baik saja di server.
 */
describe("loadAiModelsPanelData", () => {
  it("mengembalikan data gabungan saat ketiga fetch berhasil", async () => {
    stubFetch({
      "/api/admin/ai-models": { ok: true, body: MODELS_OK },
      "/api/admin/ai-settings": { ok: true, body: AI_OK },
      "/api/admin/ai-providers": { ok: true, body: PROVIDERS_OK },
    });
    const data = await loadAiModelsPanelData();
    expect(data).toEqual({
      models: MODELS_OK.models,
      providers: PROVIDERS_OK.providers,
      pointsPerUsd: 1_000,
    });
  });

  it("gagal (null) saat fetch provider mengembalikan status bukan ok, walau model berhasil", async () => {
    stubFetch({
      "/api/admin/ai-models": { ok: true, body: MODELS_OK },
      "/api/admin/ai-settings": { ok: true, body: AI_OK },
      "/api/admin/ai-providers": { ok: false, body: { ok: false } },
    });
    expect(await loadAiModelsPanelData()).toBeNull();
  });

  it("gagal (null) saat fetch provider berstatus 200 tapi ok:false", async () => {
    stubFetch({
      "/api/admin/ai-models": { ok: true, body: MODELS_OK },
      "/api/admin/ai-settings": { ok: true, body: AI_OK },
      "/api/admin/ai-providers": { ok: true, body: { ok: false } },
    });
    expect(await loadAiModelsPanelData()).toBeNull();
  });

  it("gagal (null) saat fetch model gagal — perilaku lama yang harus tetap dipertahankan", async () => {
    stubFetch({
      "/api/admin/ai-models": { ok: false, body: { ok: false } },
      "/api/admin/ai-settings": { ok: true, body: AI_OK },
      "/api/admin/ai-providers": { ok: true, body: PROVIDERS_OK },
    });
    expect(await loadAiModelsPanelData()).toBeNull();
  });

  it("tetap berhasil dengan pointsPerUsd undefined saat hanya setelan poin yang gagal — bukan syarat kritis", async () => {
    stubFetch({
      "/api/admin/ai-models": { ok: true, body: MODELS_OK },
      "/api/admin/ai-settings": { ok: false, body: { ok: false } },
      "/api/admin/ai-providers": { ok: true, body: PROVIDERS_OK },
    });
    const data = await loadAiModelsPanelData();
    expect(data).not.toBeNull();
    expect(data?.pointsPerUsd).toBeUndefined();
    expect(data?.models).toEqual(MODELS_OK.models);
    expect(data?.providers).toEqual(PROVIDERS_OK.providers);
  });
});
