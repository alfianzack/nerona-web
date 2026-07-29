import { describe, expect, it } from "vitest";

import { homeForRole, safeCallbackUrl } from "@/lib/auth-redirect";

describe("homeForRole", () => {
  it("sends an admin to the admin dashboard", () => {
    expect(homeForRole({ role: "support" })).toBe("/admin");
  });

  it("sends a tenant to their shop dashboard", () => {
    expect(homeForRole({ role: null })).toBe("/dashboard");
  });

  it("treats a missing role as a tenant", () => {
    expect(homeForRole({})).toBe("/dashboard");
  });
});

describe("safeCallbackUrl", () => {
  it("accepts a same-origin absolute path", () => {
    expect(safeCallbackUrl("/admin/users")).toBe("/admin/users");
  });

  it("keeps the query string on an accepted path", () => {
    expect(safeCallbackUrl("/transaksi?page=2")).toBe("/transaksi?page=2");
  });

  it("rejects a protocol-relative URL disguised as a path", () => {
    // A naive startsWith("/") check would hand this straight to evil.com.
    expect(safeCallbackUrl("//evil.com")).toBeNull();
  });

  it("rejects a backslash-escaped protocol-relative URL", () => {
    expect(safeCallbackUrl("/\\evil.com")).toBeNull();
  });

  it("rejects an absolute URL to another origin", () => {
    expect(safeCallbackUrl("https://evil.com")).toBeNull();
  });

  it("rejects a relative path with no leading slash", () => {
    expect(safeCallbackUrl("dashboard")).toBeNull();
  });

  it("rejects pointing back at the landing route, which would loop", () => {
    expect(safeCallbackUrl("/post-login")).toBeNull();
    expect(safeCallbackUrl("/post-login?next=%2Fpost-login")).toBeNull();
  });

  it("rejects empty and missing input", () => {
    expect(safeCallbackUrl("")).toBeNull();
    expect(safeCallbackUrl(null)).toBeNull();
    expect(safeCallbackUrl(undefined)).toBeNull();
  });
});
