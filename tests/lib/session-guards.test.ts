import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSessionMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirectMock(path),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { requireAdmin, requireUser } from "@/lib/session-guards";

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to sign-in when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

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
  });

  it("redirects to /account when the user has no admin role", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1", role: null } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/account");
  });

  it("returns the session when the user has an admin role", async () => {
    const session = { user: { id: "u1", role: "support" } };
    getServerSessionMock.mockResolvedValue(session);

    await expect(requireAdmin()).resolves.toBe(session);
  });
});
