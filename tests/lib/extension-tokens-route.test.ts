import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/extension-auth", () => ({
  createExtensionToken: vi.fn(),
  listExtensionTokens: vi.fn(),
  revokeExtensionToken: vi.fn(),
}));

import { GET, POST } from "@/app/api/extension/tokens/route";
import { DELETE } from "@/app/api/extension/tokens/[id]/route";
import { getServerSession } from "next-auth";
import { createExtensionToken, revokeExtensionToken } from "@/lib/extension-auth";

const authed = { user: { id: "u1" } };
function postReq(body: unknown) {
  return new Request("http://test/api/extension/tokens", { method: "POST", body: JSON.stringify(body) });
}
beforeEach(() => vi.clearAllMocks());

describe("extension token routes", () => {
  it("POST 401 unauthenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST(postReq({}))).status).toBe(401);
  });
  it("POST returns a freshly created token", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (createExtensionToken as any).mockResolvedValue("nrx_created");
    const res = await POST(postReq({ label: "Chrome" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, token: "nrx_created" });
    expect(createExtensionToken).toHaveBeenCalledWith("u1", "Chrome");
  });
  it("DELETE revokes scoped to the user, 404 when not found", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (revokeExtensionToken as any).mockResolvedValue(true);
    expect((await DELETE(new Request("http://test"), { params: { id: "t1" } })).status).toBe(200);
    expect(revokeExtensionToken).toHaveBeenCalledWith("u1", "t1");
    (revokeExtensionToken as any).mockResolvedValue(false);
    expect((await DELETE(new Request("http://test"), { params: { id: "x" } })).status).toBe(404);
  });
});
