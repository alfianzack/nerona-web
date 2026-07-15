import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendLicenseEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing a verify-email link with the token", async () => {
    await sendVerificationEmail("user@example.com", "abc123");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
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

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("/reset-password/xyz789");
  });
});

describe("sendLicenseEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email containing the license key", async () => {
    await sendLicenseEmail("user@example.com", "NERONA-AB12-CD34-EF56");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("NERONA-AB12-CD34-EF56");
  });
});
