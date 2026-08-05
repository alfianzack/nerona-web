import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/extension-auth", () => ({
  issueExtensionToken: vi.fn(),
  listExtensionTokens: vi.fn(),
  revokeExtensionToken: vi.fn(),
}));

import { GET, POST } from "@/app/api/extension/tokens/route";
import { DELETE } from "@/app/api/extension/tokens/[id]/route";
import { getServerSession } from "next-auth";
import { issueExtensionToken, revokeExtensionToken } from "@/lib/extension-auth";

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
  it("POST returns a freshly created token with its id", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (issueExtensionToken as any).mockResolvedValue({ id: "t1", token: "nrx_created" });
    const res = await POST(postReq({ label: "Chrome" }));
    expect(res.status).toBe(200);
    // `id` travels back so the caller can revoke the token when the handover
    // it is about to attempt goes silent.
    expect(await res.json()).toEqual({ ok: true, id: "t1", token: "nrx_created" });
    expect(issueExtensionToken).toHaveBeenCalledWith("u1", "Chrome", { replaceSameLabel: false });
  });
  it("POST only replaces same-label tokens when the caller asks", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (issueExtensionToken as any).mockResolvedValue({ id: "t2", token: "nrx_x" });
    await POST(postReq({ label: "Extension · Chrome", replace: true }));
    expect(issueExtensionToken).toHaveBeenCalledWith("u1", "Extension · Chrome", {
      replaceSameLabel: true,
    });
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
