import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    license: { findUnique: vi.fn() },
  },
}));

import { generateLicenseKey } from "@/lib/license";
import { prisma } from "@/lib/prisma";

describe("generateLicenseKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a key matching the NERONA-XXXX-XXXX-XXXX format", async () => {
    (prisma.license.findUnique as any).mockResolvedValue(null);

    const key = await generateLicenseKey();

    expect(key).toMatch(/^NERONA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("retries generation when the first candidate already exists", async () => {
    (prisma.license.findUnique as any)
      .mockResolvedValueOnce({ id: "existing-license" })
      .mockResolvedValueOnce(null);

    const key = await generateLicenseKey();

    expect(prisma.license.findUnique).toHaveBeenCalledTimes(2);
    expect(key).toMatch(/^NERONA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});
