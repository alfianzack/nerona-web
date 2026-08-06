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
    // No installation id in the body — the manual-token escape hatch, where the
    // user may be pasting the token into a second machine on purpose.
    expect(issueExtensionToken).toHaveBeenCalledWith("u1", "Chrome", {
      replaceInstallation: undefined,
    });
  });
  it("POST passes the installation id through so the old token can be replaced", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (issueExtensionToken as any).mockResolvedValue({ id: "t2", token: "nrx_x" });
    await POST(postReq({ label: "Extension · Chrome · a3f9c1d2", instalasi: "a3f9c1d2" }));
    expect(issueExtensionToken).toHaveBeenCalledWith("u1", "Extension · Chrome · a3f9c1d2", {
      replaceInstallation: "a3f9c1d2",
    });
  });
  it("POST drops a malformed installation id instead of forwarding it", async () => {
    (getServerSession as any).mockResolvedValue(authed);
    (issueExtensionToken as any).mockResolvedValue({ id: "t3", token: "nrx_y" });
    await POST(postReq({ label: "Extension · Chrome", instalasi: " · " }));
    expect(issueExtensionToken).toHaveBeenCalledWith("u1", "Extension · Chrome", {
      replaceInstallation: undefined,
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
