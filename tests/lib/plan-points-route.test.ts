import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const getPlanPointsViewMock = vi.fn();
const updatePlanPointsMock = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/plan-points", () => ({
  getPlanPointsView: () => getPlanPointsViewMock(),
  updatePlanPoints: (...args: unknown[]) => updatePlanPointsMock(...(args as [])),
}));

import { GET, POST } from "@/app/api/admin/plan-points/route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/admin/plan-points", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/plan-points", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a caller with no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    const res = await GET();

    expect(res.status).toBe(401);
    expect(getPlanPointsViewMock).not.toHaveBeenCalled();
  });

  it("returns the rows for an admin", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
    getPlanPointsViewMock.mockResolvedValue([
      { product: "metadata", plan: "pro", label: "Pro", stored: "", effective: 5_000 },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      rows: [{ product: "metadata", plan: "pro", label: "Pro", stored: "", effective: 5_000 }],
    });
  });
});

describe("POST /api/admin/plan-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
  });

  it("refuses a caller with no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    const res = await POST(post({ rows: [] }));

    expect(res.status).toBe(401);
    expect(updatePlanPointsMock).not.toHaveBeenCalled();
  });

  it("stores valid rows", async () => {
    const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: "777" }] }));

    expect(res.status).toBe(200);
    expect(updatePlanPointsMock).toHaveBeenCalledWith([
      { product: "metadata", plan: "pro", value: "777" },
    ]);
  });

  it("accepts a blank value as a clear back to the default", async () => {
    const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: "" }] }));

    expect(res.status).toBe(200);
    expect(updatePlanPointsMock).toHaveBeenCalledWith([
      { product: "metadata", plan: "pro", value: "" },
    ]);
  });

  it("accepts zero as a real allowance of nothing", async () => {
    const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: "0" }] }));

    expect(res.status).toBe(200);
  });

  it("rejects a negative or fractional allowance", async () => {
    for (const bad of ["-1", "1.5", "abc"]) {
      vi.clearAllMocks();
      getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: "support" } });
      const res = await POST(post({ rows: [{ product: "metadata", plan: "pro", value: bad }] }));

      expect(res.status).toBe(400);
      expect(updatePlanPointsMock).not.toHaveBeenCalled();
    }
  });

  it("rejects an unknown product", async () => {
    const res = await POST(post({ rows: [{ product: "courses", plan: "pro", value: "1" }] }));

    expect(res.status).toBe(400);
    expect(updatePlanPointsMock).not.toHaveBeenCalled();
  });

  it("rejects a body that is not shaped like rows", async () => {
    const res = await POST(post({ rows: "nope" }));

    expect(res.status).toBe(400);
  });
});
