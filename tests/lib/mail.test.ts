import { beforeEach, describe, expect, it, vi } from "vitest";

var sendMockFn;

vi.mock("resend", () => {
  sendMockFn = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: sendMockFn },
    })),
  };
});

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing a verify-email link with the token", async () => {
    await sendVerificationEmail("user@example.com", "abc123");

    expect(sendMockFn).toHaveBeenCalledTimes(1);
    const call = sendMockFn.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("/verify-email?token=abc123");
  });
});

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing a reset-password link with the token", async () => {
    await sendPasswordResetEmail("user@example.com", "xyz789");

    expect(sendMockFn).toHaveBeenCalledTimes(1);
    const call = sendMockFn.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("/reset-password/xyz789");
  });
});
