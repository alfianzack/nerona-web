import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extension-auth", () => ({ resolveExtensionToken: vi.fn() }));
vi.mock("@/lib/extension-sync", () => ({ getExtensionAccountState: vi.fn() }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettings: vi.fn() }));

import { GET } from "@/app/api/extension/me/route";
import { resolveExtensionToken } from "@/lib/extension-auth";
import { getExtensionAccountState } from "@/lib/extension-sync";
import { getAiSettings } from "@/lib/ai-settings";

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
    (getAiSettings as any).mockResolvedValue({
      model: "gemini-2.5-flash", apiKey: "sk-secret", pricing: {},
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
});
