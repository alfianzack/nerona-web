import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/ai-settings", () => ({ getAiSettingsView: vi.fn(), updateAiSettings: vi.fn() }));

import { GET, POST } from "@/app/api/admin/ai-settings/route";
import { getServerSession } from "next-auth";
import { getAiSettingsView, updateAiSettings } from "@/lib/ai-settings";

function postReq(body: unknown) {
  return new Request("http://test/api/admin/ai-settings", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/ai-settings", () => {
  it("401 for non-admin", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the masked view for an admin", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (getAiSettingsView as any).mockResolvedValue({ model: "gpt-5", apiKeyMasked: "****abcd", apiKeySet: true });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings).toEqual({ model: "gpt-5", apiKeyMasked: "****abcd", apiKeySet: true });
    expect(JSON.stringify(body)).not.toContain("sk-");
  });
});

describe("POST /api/admin/ai-settings", () => {
  it("401 for non-admin", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(postReq({ model: "gpt-5" }))).status).toBe(401);
  });

  it("400 on a non-object body", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const req = new Request("http://test/api/admin/ai-settings", { method: "POST", body: "not json" });
    expect((await POST(req)).status).toBe(400);
  });

  it("updates settings; a blank apiKey is passed through as undefined-ish (not written)", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const res = await POST(postReq({ model: "gpt-5", apiKey: "" }));
    expect(res.status).toBe(200);
    const call = (updateAiSettings as any).mock.calls[0][0];
    expect(call.model).toBe("gpt-5");
    expect(call.apiKey === "" || call.apiKey === undefined).toBe(true);
  });
});
