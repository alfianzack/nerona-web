import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import { butuhPembaruan, tautanAman, UNDUHAN_KEYS } from "@/lib/unduhan";
import { getUnduhanSettings, updateUnduhanSettings } from "@/lib/unduhan-settings";
import { prisma } from "@/lib/prisma";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tautanAman", () => {
  it("meneruskan https apa adanya", () => {
    const url = "https://github.com/alfianzack/nerona-hub-releases/releases/download/v0.1.0/a.msi";
    expect(tautanAman(url)).toBe(url);
    expect(tautanAman(`  ${url}  `)).toBe(url);
  });

  it("menolak apa pun yang tidak boleh jadi href", () => {
    // Nilainya diketik admin lalu langsung dipasang ke href.
    expect(tautanAman("javascript:alert(1)")).toBeNull();
    expect(tautanAman("JavaScript:alert(1)")).toBeNull();
    expect(tautanAman("data:text/html,<script>")).toBeNull();
    expect(tautanAman("http://github.com/a.msi")).toBeNull();
    expect(tautanAman("github.com/a.msi")).toBeNull();
  });

  it("menolak yang kosong atau tersalin separuh", () => {
    expect(tautanAman("")).toBeNull();
    expect(tautanAman("   ")).toBeNull();
    expect(tautanAman(null)).toBeNull();
    expect(tautanAman(undefined)).toBeNull();
    expect(tautanAman("https://")).toBeNull();
    expect(tautanAman("https://github.com/dua kata.msi")).toBeNull();
  });
});

describe("butuhPembaruan", () => {
  it("menegur hanya kalau kedua versi diketahui dan berbeda", () => {
    expect(butuhPembaruan("1.2", "1.3")).toBe(true);
    expect(butuhPembaruan("1.3", "1.3")).toBe(false);
  });

  it("tidak menegur atas dasar ketidaktahuan", () => {
    // Peringatan yang muncul saat kita tidak tahu apa-apa akan berhenti
    // dipercaya justru saat ia benar.
    expect(butuhPembaruan(null, "1.3")).toBe(false);
    expect(butuhPembaruan("", "1.3")).toBe(false);
    expect(butuhPembaruan("?", "1.3")).toBe(false);
    expect(butuhPembaruan("1.2", "")).toBe(false);
    expect(butuhPembaruan("1.2", null)).toBe(false);
  });
});

describe("getUnduhanSettings", () => {
  it("mengembalikan string kosong untuk baris yang belum pernah diisi", async () => {
    (prisma.setting.findMany as any).mockResolvedValue([
      { key: UNDUHAN_KEYS.hubWindowsUrl, value: "https://x/y.msi" },
    ]);
    expect(await getUnduhanSettings()).toEqual({
      hubWindowsUrl: "https://x/y.msi",
      hubMacUrl: "",
      hubVersion: "",
      extensionUrl: "",
      extensionVersion: "",
    });
  });
});

describe("updateUnduhanSettings", () => {
  it("menulis kelima kunci dalam satu transaksi, sudah di-trim", async () => {
    await updateUnduhanSettings({
      hubWindowsUrl: "  https://x/y.msi  ",
      hubMacUrl: "",
      hubVersion: "0.1.0",
      extensionUrl: "",
      extensionVersion: "1.3",
    });

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(5);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const keys = (prisma.setting.upsert as any).mock.calls.map((c: any[]) => c[0].where.key);
    expect(keys.sort()).toEqual(Object.values(UNDUHAN_KEYS).sort());
    const windows = (prisma.setting.upsert as any).mock.calls.find(
      (c: any[]) => c[0].where.key === UNDUHAN_KEYS.hubWindowsUrl
    );
    // Spasi di ujung URL yang tersalin dari GitHub akan membuat `tautanAman`
    // menolaknya dan tombolnya mati tanpa sebab yang terlihat admin.
    expect(windows[0].update.value).toBe("https://x/y.msi");
  });
});
