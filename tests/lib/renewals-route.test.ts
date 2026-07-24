import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing/renewals", () => ({ generateDueRenewals: vi.fn() }));

import { GET } from "@/app/api/billing/renewals/route";
import { generateDueRenewals } from "@/lib/billing/renewals";

const OLD = process.env.CRON_SECRET;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  (generateDueRenewals as any).mockResolvedValue({ created: 2 });
});
afterEach(() => {
  process.env.CRON_SECRET = OLD;
});

function req(auth?: string) {
  return new Request("http://test/api/billing/renewals", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/billing/renewals", () => {
  it("401 without the correct bearer secret", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(generateDueRenewals).not.toHaveBeenCalled();
  });
  it("runs the sweep with the correct secret", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, created: 2 });
  });
});
