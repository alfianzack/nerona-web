import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/ai-connection-test", () => ({ testAiConnection: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ hit: vi.fn() }));

import { POST } from "@/app/api/admin/ai-settings/test/route";
import { getServerSession } from "next-auth";
import { testAiConnection } from "@/lib/ai-connection-test";
import { hit } from "@/lib/rate-limit";

const passing = {
  ok: true,
  configured: true,
  model: "gpt-5-nano",
  text: { ok: true },
  vision: { ok: true },
};

describe("POST /api/admin/ai-settings/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as any).mockResolvedValue({ user: { id: "a1", role: "owner_admin" } });
    (hit as any).mockReturnValue({ ok: true });
    (testAiConnection as any).mockResolvedValue(passing);
  });

  it("401 without an admin role", async () => {
    (getServerSession as any).mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    expect(testAiConnection).not.toHaveBeenCalled();
  });

  it("401 for a signed-in tenant with no role", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: null } });
    expect((await POST()).status).toBe(401);
    expect(testAiConnection).not.toHaveBeenCalled();
  });

  it("returns the probe result to an admin", async () => {
    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, result: passing });
  });

  it("rate limits repeated checks, since each one costs real AI calls", async () => {
    (hit as any).mockReturnValue({ ok: false, retryAfterSeconds: 20 });

    const res = await POST();

    expect(res.status).toBe(429);
    expect(testAiConnection).not.toHaveBeenCalled();
  });

  it("still reports a failing probe as a 200 so the UI can render the detail", async () => {
    (testAiConnection as any).mockResolvedValue({
      ...passing,
      ok: false,
      vision: { ok: false, error: "model does not support image input" },
    });

    const res = await POST();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.ok).toBe(false);
    expect(body.result.vision.error).toContain("image");
  });

  it("502 when the probe itself throws", async () => {
    (testAiConnection as any).mockRejectedValue(new Error("boom"));
    expect((await POST()).status).toBe(502);
  });
});
