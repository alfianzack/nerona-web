import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
const headerMock = vi.fn(() => null as string | null);

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("next/headers", () => ({
  // requireUser only ever asks for x-pathname, so the key is not asserted.
  headers: () => ({ get: () => headerMock() }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { requireAdmin, requireUser } from "@/lib/session-guards";

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headerMock.mockReturnValue(null);
  });

  it("redirects to sign-in when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("carries the intended path so the deep link survives sign-in", async () => {
    getServerSessionMock.mockResolvedValue(null);
    headerMock.mockReturnValue("/transaksi");

    await expect(requireUser()).rejects.toThrow(
      "REDIRECT:/login?callbackUrl=%2Ftransaksi"
    );
  });

  it("ignores an off-origin path the header should never contain", async () => {
    getServerSessionMock.mockResolvedValue(null);
    headerMock.mockReturnValue("//evil.com");

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("returns the session when signed in", async () => {
    const session = { user: { id: "u1", role: null } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireUser()).resolves.toBe(session);
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headerMock.mockReturnValue(null);
  });

  it("sends a non-admin to their own dashboard", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("returns the session when the user has an admin role", async () => {
    const session = { user: { id: "u1", role: "support" } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toBe(session);
  });
});
