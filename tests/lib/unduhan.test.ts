import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import {
  bandingkanVersi,
  butuhPembaruan,
  diBawahMinimum,
  tautanAman,
  UNDUHAN_KEYS,
} from "@/lib/unduhan";
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

describe("bandingkanVersi", () => {
  it("mengurutkan per ruas angka, bukan per abjad", () => {
    // Perbandingan string akan bilang "1.10" < "1.9". Itu persis kesalahan yang
    // membuat gerbang minimum memblokir orang yang sudah memperbarui.
    expect(bandingkanVersi("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(bandingkanVersi("1.9.0", "1.10.0")).toBeLessThan(0);
    expect(bandingkanVersi("2.0.0", "10.0.0")).toBeLessThan(0);
  });

  it("menganggap ruas yang tidak ditulis sebagai nol", () => {
    expect(bandingkanVersi("1.2", "1.2.0")).toBe(0);
    expect(bandingkanVersi("1.2.1", "1.2")).toBeGreaterThan(0);
    expect(bandingkanVersi("1", "1.0.0")).toBe(0);
  });

  it("menganggap ruas yang bukan angka sebagai nol", () => {
    // "1.1.0-beta" datang dari build percobaan. Ia tidak boleh membuat
    // perbandingannya melempar; cukup dibaca sebagai 1.1.0.
    expect(bandingkanVersi("1.1.0-beta", "1.1.0")).toBe(0);
    expect(bandingkanVersi("?", "0.0.0")).toBe(0);
    expect(bandingkanVersi("", "0")).toBe(0);
  });
});

describe("butuhPembaruan", () => {
  it("menegur hanya kalau yang terpasang benar-benar tertinggal", () => {
    expect(butuhPembaruan("1.2", "1.3")).toBe(true);
    expect(butuhPembaruan("1.3", "1.3")).toBe(false);
  });

  it("tidak menegur pemasangan yang justru lebih baru", () => {
    // Build percobaan owner mendahului yang tercatat di Setting. Menegurnya
    // membuat peringatan itu berhenti dipercaya.
    expect(butuhPembaruan("1.4", "1.3")).toBe(false);
    expect(butuhPembaruan("1.10", "1.9")).toBe(false);
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

describe("diBawahMinimum", () => {
  it("memblokir yang benar-benar di bawah batas", () => {
    expect(diBawahMinimum("1.0.9", "1.1.0")).toBe(true);
    expect(diBawahMinimum("1.1.0", "1.1.0")).toBe(false);
    expect(diBawahMinimum("1.2.0", "1.1.0")).toBe(false);
  });

  it("tanpa minimum berarti tanpa gerbang", () => {
    // Kebijakan yang belum ditetapkan tidak boleh mengunci siapa pun — termasuk
    // saat versi terpasangnya juga tidak diketahui.
    expect(diBawahMinimum("1.0.0", "")).toBe(false);
    expect(diBawahMinimum("1.0.0", null)).toBe(false);
    expect(diBawahMinimum(null, "")).toBe(false);
    expect(diBawahMinimum(null, undefined)).toBe(false);
  });

  it("versi yang tidak diketahui dianggap di bawah minimum apa pun", () => {
    // Berlawanan dengan butuhPembaruan, dan disengaja: permintaan yang tidak
    // menyebut versinya datang dari salinan yang terbit sebelum header ini ada,
    // dan salinan itu memang yang hendak diblokir.
    expect(diBawahMinimum(null, "1.1.0")).toBe(true);
    expect(diBawahMinimum("", "1.1.0")).toBe(true);
    expect(diBawahMinimum("?", "1.1.0")).toBe(true);
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
      extensionMinVersion: "",
    });
  });
});

describe("updateUnduhanSettings", () => {
  it("menulis seluruh kunci dalam satu transaksi, sudah di-trim", async () => {
    await updateUnduhanSettings({
      hubWindowsUrl: "  https://x/y.msi  ",
      hubMacUrl: "",
      hubVersion: "0.1.0",
      extensionUrl: "",
      extensionVersion: "1.3",
      extensionMinVersion: "",
    });

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(6);
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

  it("kunci yang tidak disebut tidak disentuh, yang disebut kosong tetap dikosongkan", async () => {
    // Ini yang membuat CI boleh menulis versi Hub tanpa ikut menghapus versi
    // extension yang tidak ia ketahui apa-apa tentangnya.
    await updateUnduhanSettings({ hubVersion: "0.1.1", hubMacUrl: "" });

    const keys = (prisma.setting.upsert as any).mock.calls.map((c: any[]) => c[0].where.key);
    expect(keys.sort()).toEqual([UNDUHAN_KEYS.hubMacUrl, UNDUHAN_KEYS.hubVersion].sort());
  });
});
