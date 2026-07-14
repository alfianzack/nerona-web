import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminRole: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
}));

import { authorizeCredentials, getAdminRole, jwtCallback, sessionCallback } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

describe("getAdminRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the role when an AdminRole row exists", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue({ role: "owner_admin" });

    const role = await getAdminRole("user-1");

    expect(role).toBe("owner_admin");
    expect(prisma.adminRole.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("returns null when no AdminRole row exists", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue(null);

    const role = await getAdminRole("user-2");

    expect(role).toBeNull();
  });
});

describe("authorizeCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user when email and password match", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      password: "hashed",
    });
    (verifyPassword as any).mockResolvedValue(true);

    const result = await authorizeCredentials("a@example.com", "correct-password");

    expect(result).toEqual({ id: "user-1", email: "a@example.com", name: "A" });
    expect(verifyPassword).toHaveBeenCalledWith("correct-password", "hashed");
  });

  it("returns null when the password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      password: "hashed",
    });
    (verifyPassword as any).mockResolvedValue(false);

    const result = await authorizeCredentials("a@example.com", "wrong-password");

    expect(result).toBeNull();
  });

  it("returns null when the user has no password set (Google-only account)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "user-1",
      email: "a@example.com",
      name: "A",
      password: null,
    });

    const result = await authorizeCredentials("a@example.com", "any-password");

    expect(result).toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns null when no user exists with that email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const result = await authorizeCredentials("nobody@example.com", "any-password");

    expect(result).toBeNull();
  });
});

describe("jwtCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores id and role on the token when a user signs in", async () => {
    (prisma.adminRole.findUnique as any).mockResolvedValue({ role: "owner_admin" });

    const token = await jwtCallback({ token: {}, user: { id: "user-1" } } as any);

    expect(token).toMatchObject({ id: "user-1", role: "owner_admin" });
  });

  it("leaves the token unchanged when there is no user (token refresh)", async () => {
    const existingToken = { id: "user-1", role: "support" };

    const token = await jwtCallback({ token: existingToken } as any);

    expect(token).toBe(existingToken);
    expect(prisma.adminRole.findUnique).not.toHaveBeenCalled();
  });
});

describe("sessionCallback", () => {
  it("copies id and role from the token onto session.user", () => {
    const session = { user: { email: "a@example.com" } } as any;
    const token = { id: "user-1", role: "owner_admin" } as any;

    const result = sessionCallback({ session, token });

    expect(result.user.id).toBe("user-1");
    expect(result.user.role).toBe("owner_admin");
  });
});
