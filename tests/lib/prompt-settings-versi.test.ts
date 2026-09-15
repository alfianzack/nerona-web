import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import {
  KEY_METADATA_ADVANCED,
  KEY_METADATA_VERSI,
  getPromptSettings,
  getPromptSettingsView,
  updatePromptSettings,
} from "@/lib/extension/prompt-settings";
import {
  METADATA_GENERATOR_PROMPT_ADVANCED,
  METADATA_GENERATOR_PROMPT_PRA_V4,
} from "@/lib/extension/prompts";
import { prisma } from "@/lib/prisma";

function baris(map: Record<string, string>) {
  (prisma.setting.findMany as any).mockResolvedValue(
    Object.entries(map).map(([key, value]) => ({ key, value }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  baris({});
  (prisma.$transaction as any).mockImplementation((ops: unknown[]) => Promise.resolve(ops));
});

/**
 * Saklar versi prompt metadata.
 *
 * Sebelum ini, satu-satunya cara kembali ke prompt lama adalah menempelkan
 * teksnya ke kotak override, dan teks itu lalu jadi SALINAN BEKU di basis data:
 * kalau prompt v4 diperbaiki nanti, tidak ada yang tahu bahwa yang hidup di
 * produksi adalah salinan lama, karena penanda "dioverride" tidak menyebut versi
 * apa pun. Saklar ini yang membuat keadaan itu bisa dibaca.
 */
describe("versi prompt metadata", () => {
  it("tanpa setelan apa pun: v4, prompt yang berlaku hari ini", async () => {
    const { advanced, versi } = await getPromptSettings();
    expect(versi).toBe("v4");
    expect(advanced).toBe(METADATA_GENERATOR_PROMPT_ADVANCED);
  });

  it("versi pra_v4 memakai konstanta prompt lama, bukan teks di DB", async () => {
    baris({ [KEY_METADATA_VERSI]: "pra_v4", [KEY_METADATA_ADVANCED]: "teks kustom lama" });
    const { advanced, versi } = await getPromptSettings();
    expect(versi).toBe("pra_v4");
    expect(advanced).toBe(METADATA_GENERATOR_PROMPT_PRA_V4);
  });

  it("versi kustom memakai teks yang disimpan owner", async () => {
    baris({ [KEY_METADATA_VERSI]: "kustom", [KEY_METADATA_ADVANCED]: "teks kustom saya" });
    const { advanced, versi } = await getPromptSettings();
    expect(versi).toBe("kustom");
    expect(advanced).toBe("teks kustom saya");
  });

  it("kustom tanpa teks jatuh ke v4, bukan mengirim prompt kosong ke model", async () => {
    baris({ [KEY_METADATA_VERSI]: "kustom", [KEY_METADATA_ADVANCED]: "   " });
    const { advanced } = await getPromptSettings();
    expect(advanced).toBe(METADATA_GENERATOR_PROMPT_ADVANCED);
  });

  /**
   * Owner yang sudah menempelkan prompt sendiri SEBELUM saklar ini ada tidak
   * punya baris versi sama sekali. Menganggapnya "v4" akan mengembalikan
   * produksi ke bawaan pada deploy pertama, tanpa satu pun tanda.
   */
  it("override lama tanpa baris versi tetap berlaku sebagai kustom", async () => {
    baris({ [KEY_METADATA_ADVANCED]: "prompt lama owner" });
    const { advanced, versi } = await getPromptSettings();
    expect(versi).toBe("kustom");
    expect(advanced).toBe("prompt lama owner");
  });

  it("nilai versi asing jatuh ke v4", async () => {
    baris({ [KEY_METADATA_VERSI]: "entah" });
    expect((await getPromptSettings()).versi).toBe("v4");
  });

  /**
   * Keputusan owner 2026-09-15: teks kustom DISIMPAN saat pindah versi. Menghapus
   * barisnya berarti pekerjaan menulis prompt sendiri hilang hanya karena owner
   * ingin membandingkannya sebentar dengan bawaan.
   */
  it("pindah ke v4 tidak menghapus teks kustom yang tersimpan", async () => {
    await updatePromptSettings({ versi: "v4" });
    expect(prisma.setting.deleteMany).not.toHaveBeenCalled();
    const kunci = (prisma.setting.upsert as any).mock.calls.map((c: any[]) => c[0].where.key);
    expect(kunci).toContain(KEY_METADATA_VERSI);
    expect(kunci).not.toContain(KEY_METADATA_ADVANCED);
  });

  it("menyimpan teks kustom sekaligus memilih versi kustom", async () => {
    await updatePromptSettings({ versi: "kustom", advanced: "punya saya" });
    const tulis = (prisma.setting.upsert as any).mock.calls.map((c: any[]) => [
      c[0].where.key,
      c[0].create.value,
    ]);
    expect(tulis).toEqual(
      expect.arrayContaining([
        [KEY_METADATA_VERSI, "kustom"],
        [KEY_METADATA_ADVANCED, "punya saya"],
      ])
    );
  });

  it("panel bisa mengatakan versi mana yang sedang hidup", async () => {
    baris({ [KEY_METADATA_VERSI]: "pra_v4" });
    const view = await getPromptSettingsView();
    expect(view.versi).toBe("pra_v4");
    // Teks kedua versi ikut dikirim supaya panel bisa menampilkannya tanpa
    // menebak, dan tanpa menyalin prompt ke komponen klien.
    expect(view.teks.v4).toBe(METADATA_GENERATOR_PROMPT_ADVANCED);
    expect(view.teks.pra_v4).toBe(METADATA_GENERATOR_PROMPT_PRA_V4);
  });
});
