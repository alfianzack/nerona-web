import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/admin", () => ({
  isAgentPlanExpired: vi.fn(),
}));
vi.mock("@/lib/agent/limits", () => ({
  hasExceededMonthlyLimit: vi.fn(),
}));
vi.mock("@/lib/points", () => ({
  getBalance: vi.fn(),
}));
vi.mock("@/lib/base-url", () => ({
  baseUrl: () => "https://nerona.test",
}));

import { checkAgentGates } from "@/lib/agent/gates";
import { isAgentPlanExpired } from "@/lib/agent/admin";
import { hasExceededMonthlyLimit } from "@/lib/agent/limits";
import { getBalance } from "@/lib/points";

const profile = {
  id: "profile-1",
  userId: "user-1",
  plan: "pro",
  planExpiresAt: null as Date | null,
};

describe("checkAgentGates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isAgentPlanExpired as any).mockReturnValue(false);
    (hasExceededMonthlyLimit as any).mockResolvedValue(false);
    (getBalance as any).mockResolvedValue(500);
  });

  it("returns null when every gate passes", async () => {
    expect(await checkAgentGates(profile)).toBeNull();
  });

  it("blocks an expired plan before checking anything else", async () => {
    (isAgentPlanExpired as any).mockReturnValue(true);

    const result = await checkAgentGates(profile);

    expect(result?.blocked).toBe("plan_expired");
    expect(result?.message).toContain("Paket Anda sudah berakhir");
    expect(hasExceededMonthlyLimit).not.toHaveBeenCalled();
    expect(getBalance).not.toHaveBeenCalled();
  });

  it("blocks when the monthly message quota is used up", async () => {
    (hasExceededMonthlyLimit as any).mockResolvedValue(true);

    const result = await checkAgentGates(profile);

    expect(result?.blocked).toBe("quota");
    expect(result?.message).toContain("Kuota pesan bulanan");
    expect(getBalance).not.toHaveBeenCalled();
  });

  it("blocks when the points wallet is empty", async () => {
    (getBalance as any).mockResolvedValue(0);

    const result = await checkAgentGates(profile);

    expect(result?.blocked).toBe("no_points");
    expect(result?.message).toContain("poin");
  });

  it("treats a negative balance as empty", async () => {
    (getBalance as any).mockResolvedValue(-5);

    expect((await checkAgentGates(profile))?.blocked).toBe("no_points");
  });

  it("checks quota against the profile's own id and plan", async () => {
    await checkAgentGates(profile);

    expect(hasExceededMonthlyLimit).toHaveBeenCalledWith("profile-1", "pro");
    expect(getBalance).toHaveBeenCalledWith("user-1");
  });
});
