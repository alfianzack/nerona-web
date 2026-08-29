import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/ai-models", () => ({ resolveAiForUser: vi.fn() }));
vi.mock("@/lib/extension-version", () => ({ infoPembaruanExtension: vi.fn() }));

import { GET } from "@/app/api/extension/me/route";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { resolveAiForUser } from "@/lib/ai-models";
import { infoPembaruanExtension } from "@/lib/extension-version";

function req(auth?: string) {
  return new Request("http://test/api/extension/me", { headers: auth ? { authorization: auth } : {} });
}
beforeEach(() => vi.clearAllMocks());

describe("GET /api/extension/me", () => {
  it("401 without a bearer token", async () => {
    expect((await GET(req())).status).toBe(401);
  });
  it("401 for an invalid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue(null);
    expect((await GET(req("Bearer bad"))).status).toBe(401);
  });
  it("200 with account state for a valid token", async () => {
    (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
    (getExtensionAccountState as any).mockResolvedValue({
      email: "u@x.com", plan: "Pro", licenseStatus: "active",
      validUntil: new Date("2026-08-01T00:00:00Z"), marketplaces: "*",
      rejectAnalyzer: false, pointsBalance: 1250, active: true,
    });
    (resolveAiForUser as any).mockResolvedValue({
      modelId: "gemini-2.5-flash", apiKey: "sk-secret", pricing: {},
    });
    (infoPembaruanExtension as any).mockResolvedValue({
      latest: "1.2.0", min: "1.1.0", url: "https://nerona-web.vercel.app/unduh",
    });
    const res = await GET(req("Bearer nrx_ok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account).toMatchObject({ plan: "Pro", active: true, pointsBalance: 1250 });
    expect(body.account.validUntil).toBe("2026-08-01T00:00:00.000Z");
    expect(body.ai).toEqual({ model: "gemini-2.5-flash" });
    // Kunci API tidak boleh ikut keluar ke ekstensi.
    expect(JSON.stringify(body)).not.toContain("sk-secret");
  });

  it("membawa blok update supaya badge tidak perlu permintaan kedua", async () => {
    (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
    (getExtensionAccountState as any).mockResolvedValue({
      email: "u@x.com", plan: "Pro", licenseStatus: "active",
      validUntil: null, marketplaces: "*",
      rejectAnalyzer: false, pointsBalance: 10, active: true,
    });
    (resolveAiForUser as any).mockResolvedValue({ modelId: "m", apiKey: "k", pricing: {} });
    (infoPembaruanExtension as any).mockResolvedValue({
      latest: "1.2.0", min: "", url: "https://nerona-web.vercel.app/unduh",
    });
    const body = await (await GET(req("Bearer nrx_ok"))).json();
    expect(body.update).toEqual({
      latest: "1.2.0", min: "", url: "https://nerona-web.vercel.app/unduh",
    });
  });

  /// Daftar marketplace yang berwenang ikut di setiap panggilan, jadi klien
  /// tidak perlu menyalinnya dengan tangan lagi.
  it("membawa daftar marketplace yang berwenang", async () => {
    (resolveExtensionToken as any).mockResolvedValue({ userId: "u1" });
    (getExtensionAccountState as any).mockResolvedValue({
      email: "u@x.com", plan: "Pro", licenseStatus: "active",
      validUntil: null, marketplaces: "*",
      rejectAnalyzer: false, pointsBalance: 10, active: true,
    });
    (resolveAiForUser as any).mockResolvedValue({ modelId: "m", apiKey: "k", pricing: {} });
    (infoPembaruanExtension as any).mockResolvedValue({ latest: "", min: "", url: "" });

    const body = await (await GET(req("Bearer nrx_ok"))).json();
    expect(Array.isArray(body.allMarketplaces)).toBe(true);
    // Nilai yang menentukan: `api::allows` di Hub dan ekspansi `*` di extension
    // membandingkan id dengan daftar ini.
    expect(body.allMarketplaces).toContain("adobe");
    expect(body.allMarketplaces).toContain("canva");
    expect(body.allMarketplaces.every((k: unknown) => typeof k === "string")).toBe(true);
  });
});
