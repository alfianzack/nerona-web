import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const listForTenantMock = vi.fn();
const setTenantModelMock = vi.fn();
const listForAdminMock = vi.fn();
const createModelMock = vi.fn();
const updateModelMock = vi.fn();
const deleteModelMock = vi.fn();
const setDefaultModelMock = vi.fn();
const accountStateMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/extension-sync", () => ({
  getExtensionAccountState: (...a: unknown[]) => accountStateMock(...(a as [])),
}));
vi.mock("@/lib/ai-models", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-models")>("@/lib/ai-models");
  return {
    ...actual,
    listModelsForTenant: (...a: unknown[]) => listForTenantMock(...(a as [])),
    setTenantModel: (...a: unknown[]) => setTenantModelMock(...(a as [])),
    listModelsForAdmin: (...a: unknown[]) => listForAdminMock(...(a as [])),
    createModel: (...a: unknown[]) => createModelMock(...(a as [])),
    updateModel: (...a: unknown[]) => updateModelMock(...(a as [])),
    deleteModel: (...a: unknown[]) => deleteModelMock(...(a as [])),
    setDefaultModel: (...a: unknown[]) => setDefaultModelMock(...(a as [])),
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn().mockResolvedValue({ aiModelId: "m1" }) } },
}));

import { GET as tenantGet, PATCH as tenantPatch } from "@/app/api/model/route";
import {
  GET as adminGet,
  POST as adminPost,
} from "@/app/api/admin/ai-models/route";
import { DELETE as adminDelete, PATCH as adminPatch } from "@/app/api/admin/ai-models/[id]/route";
import { AiModelError } from "@/lib/ai-models";

function body(payload: unknown, method = "PATCH"): Request {
  return new Request("http://localhost/api/model", { method, body: JSON.stringify(payload) });
}

const ctx = { params: { id: "m1" } };

const VALID_MODEL = {
  label: "Claude Opus 5",
  modelId: "claude-opus-5",
  inPerMTok: 5,
  outPerMTok: 25,
  vision: true,
  paidOnly: true,
  active: true,
  providerId: "p1",
};

beforeEach(() => {
  vi.clearAllMocks();
  getServerSessionMock.mockResolvedValue({ user: { id: "user-1", role: null } });
  accountStateMock.mockResolvedValue({ plan: "Pro", active: true });
  listForTenantMock.mockResolvedValue([]);
  listForAdminMock.mockResolvedValue([]);
});

describe("GET /api/model", () => {
  it("refuses an anonymous caller", async () => {
    getServerSessionMock.mockResolvedValue(null);
    expect((await tenantGet()).status).toBe(401);
    expect(listForTenantMock).not.toHaveBeenCalled();
  });

  it("treats an active Pro licence as a paid plan", async () => {
    await tenantGet();
    expect(listForTenantMock).toHaveBeenCalledWith({ paidPlan: true });
  });

  it("treats Free as not paid, so paid-only models stay hidden", async () => {
    accountStateMock.mockResolvedValue({ plan: "Free", active: true });
    await tenantGet();
    expect(listForTenantMock).toHaveBeenCalledWith({ paidPlan: false });
  });

  it("treats an expired licence as not paid", async () => {
    accountStateMock.mockResolvedValue({ plan: "Business", active: false });
    await tenantGet();
    expect(listForTenantMock).toHaveBeenCalledWith({ paidPlan: false });
  });
});

describe("PATCH /api/model", () => {
  it("stores the tenant's choice with their own plan context", async () => {
    const res = await tenantPatch(body({ modelId: "m1" }));
    expect(res.status).toBe(200);
    expect(setTenantModelMock).toHaveBeenCalledWith("user-1", "m1", { paidPlan: true });
  });

  it("accepts null as 'back to the owner default'", async () => {
    await tenantPatch(body({ modelId: null }));
    expect(setTenantModelMock).toHaveBeenCalledWith("user-1", null, { paidPlan: true });
  });

  it("turns a refused paid-only pick into a 403 the page can explain", async () => {
    setTenantModelMock.mockRejectedValue(new AiModelError("paid_only"));
    const res = await tenantPatch(body({ modelId: "m1" }));
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/paket/i);
  });

  it("answers 404 for a model that does not exist", async () => {
    setTenantModelMock.mockRejectedValue(new AiModelError("not_found"));
    expect((await tenantPatch(body({ modelId: "gone" }))).status).toBe(404);
  });
});

describe("/api/admin/ai-models", () => {
  it("refuses a caller with no admin role", async () => {
    expect((await adminGet()).status).toBe(401);
    expect(listForAdminMock).not.toHaveBeenCalled();
  });

  it("lists for an admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    expect((await adminGet()).status).toBe(200);
    expect(listForAdminMock).toHaveBeenCalled();
  });

  it("creates a model", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    createModelMock.mockResolvedValue({ id: "m9" });
    const res = await adminPost(body(VALID_MODEL, "POST"));
    expect(res.status).toBe(200);
    expect(createModelMock).toHaveBeenCalledWith(expect.objectContaining({ modelId: "claude-opus-5" }));
  });

  it("rejects a negative rate before it can under-charge anyone", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const res = await adminPost(body({ ...VALID_MODEL, inPerMTok: -1 }, "POST"));
    expect(res.status).toBe(400);
    expect(createModelMock).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric rate", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const res = await adminPost(body({ ...VALID_MODEL, outPerMTok: "mahal" }, "POST"));
    expect(res.status).toBe(400);
    expect(createModelMock).not.toHaveBeenCalled();
  });

  it("makes a model the default", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const res = await adminPatch(body({ isDefault: true }), ctx);
    expect(res.status).toBe(200);
    expect(setDefaultModelMock).toHaveBeenCalledWith("m1");
    expect(updateModelMock).not.toHaveBeenCalled();
  });

  it("edits a model", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    updateModelMock.mockResolvedValue({ id: "m1" });
    const res = await adminPatch(body(VALID_MODEL), ctx);
    expect(res.status).toBe(200);
    expect(updateModelMock).toHaveBeenCalledWith("m1", expect.objectContaining({ label: "Claude Opus 5" }));
  });

  it("deletes a model", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    const res = await adminDelete(body({}, "DELETE"), ctx);
    expect(res.status).toBe(200);
    expect(deleteModelMock).toHaveBeenCalledWith("m1");
  });

  it("refuses a non-admin on every write", async () => {
    expect((await adminPost(body(VALID_MODEL, "POST"))).status).toBe(401);
    expect((await adminPatch(body(VALID_MODEL), ctx)).status).toBe(401);
    expect((await adminDelete(body({}, "DELETE"), ctx)).status).toBe(401);
    expect(createModelMock).not.toHaveBeenCalled();
    expect(updateModelMock).not.toHaveBeenCalled();
    expect(deleteModelMock).not.toHaveBeenCalled();
  });

  it("menolak admin support di rute model dengan 403", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    expect((await adminGet()).status).toBe(403);
    expect((await adminPost(body(VALID_MODEL, "POST"))).status).toBe(403);
    expect((await adminPatch(body(VALID_MODEL), ctx)).status).toBe(403);
    expect((await adminDelete(body({}, "DELETE"), ctx)).status).toBe(403);
  });

  it("tidak mengubah rute tenant — tenant biasa tetap boleh memilih model", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });
    accountStateMock.mockResolvedValue({ active: true, plan: "pro" });
    expect((await tenantGet()).status).toBe(200);
  });
});
