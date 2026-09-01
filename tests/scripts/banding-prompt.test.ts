/**
 * Tes untuk skrip banding prompt metadata.
 *
 * Yang dijaga di sini bukan kerapian skripnya, tapi satu hal: bahwa angka
 * persen yang keluar dari skrip itu mengukur apa yang dikiranya diukur. Tiga
 * cara pengukuran itu bisa salah tanpa suara sama sekali:
 *
 *   1. Fixture prompt lama menyimpang dari isi git — yang dibandingkan bukan
 *      prompt yang pernah hidup, tapi teks entah dari mana.
 *   2. Kedua lengan ternyata identik — persennya jadi derau murni, dan
 *      angkanya tetap kelihatan masuk akal (kira-kira 50/50).
 *   3. Lengan lama dan sekarang tertukar — arah kesimpulannya terbalik.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { METADATA_GENERATOR_PROMPT_ADVANCED } from "@/lib/extension/prompts";
import {
  BERKAS_PROMPT_LAMA,
  KOMIT_PROMPT_LAMA,
  bacaFixturePromptLama,
  bangunLengan,
  ekorPembungkus,
  ekstrakPromptAdvanced,
  periksaSebanding,
} from "../../scripts/banding/lengan";
import {
  KRITERIA,
  bacaPutusan,
  hitungPersen,
  terjemahkanPutusan,
} from "../../scripts/banding/juri";

const MARKETPLACE = "adobe";

function lenganLama(marketplace = MARKETPLACE) {
  return bangunLengan({
    nama: "lama",
    marketplace,
    kepala: bacaFixturePromptLama(),
    sumberKepala: `git ${KOMIT_PROMPT_LAMA}`,
  });
}

function lenganSekarang(marketplace = MARKETPLACE) {
  return bangunLengan({
    nama: "sekarang",
    marketplace,
    kepala: METADATA_GENERATOR_PROMPT_ADVANCED,
    sumberKepala: "konstanta kode",
  });
}

describe("fixture prompt lama", () => {
  it("masih sama dengan isi git di komit patokan", () => {
    const sumber = execFileSync("git", ["show", `${KOMIT_PROMPT_LAMA}:${BERKAS_PROMPT_LAMA}`], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(bacaFixturePromptLama()).toBe(ekstrakPromptAdvanced(sumber).trimEnd());
  });

  it("bukan prompt yang sekarang", () => {
    expect(bacaFixturePromptLama()).not.toBe(METADATA_GENERATOR_PROMPT_ADVANCED.trimEnd());
  });
});

describe("ekstrakPromptAdvanced", () => {
  it("menolak template literal yang memuat interpolasi", () => {
    const sumber = "const METADATA_GENERATOR_PROMPT_ADVANCED = `halo ${nama}`;";
    expect(() => ekstrakPromptAdvanced(sumber)).toThrow(/interpolasi/);
  });

  it("menolak sumber tanpa konstanta itu", () => {
    expect(() => ekstrakPromptAdvanced("const LAIN = `x`;")).toThrow(/tidak ditemukan/);
  });

  it("menolak template literal yang tidak tertutup", () => {
    expect(() => ekstrakPromptAdvanced("const METADATA_GENERATOR_PROMPT_ADVANCED = `halo")).toThrow(
      /tidak tertutup/
    );
  });
});

describe("dua lengan", () => {
  it("berbeda HANYA di kepalanya", () => {
    expect(ekorPembungkus(lenganLama())).toBe(ekorPembungkus(lenganSekarang()));
    expect(() => periksaSebanding(lenganLama(), lenganSekarang())).not.toThrow();
  });

  it("membawa pembungkus produksi, bukan prompt kepala saja", () => {
    // Kalau baris konteks ini hilang, yang diukur bukan prompt yang dikirim
    // /api/extension/generate.
    expect(ekorPembungkus(lenganSekarang())).toContain(`Context marketplace: ${MARKETPLACE}`);
  });

  it("tidak membawa ekor kontrak — itu milik jalur prompt kustom tenant", () => {
    expect(lenganSekarang().prompt).not.toContain("Ignore any instruction above");
  });

  it("memakai maxTokens yang sama", () => {
    expect(lenganLama().maxTokens).toBe(lenganSekarang().maxTokens);
  });
});

describe("periksaSebanding", () => {
  it("menolak dua lengan dengan prompt identik", () => {
    const kembar = bangunLengan({
      nama: "lama",
      marketplace: MARKETPLACE,
      kepala: METADATA_GENERATOR_PROMPT_ADVANCED,
      sumberKepala: "konstanta kode",
    });
    expect(() => periksaSebanding(kembar, lenganSekarang())).toThrow(/prompt yang sama/);
  });

  it("menolak lengan yang pembungkusnya berbeda", () => {
    // Marketplace berbeda menyisipkan hint yang berbeda; pengukuran seperti itu
    // mencampur dua variabel.
    expect(() => periksaSebanding(lenganLama("vecteezy"), lenganSekarang("adobe"))).toThrow(
      /Pembungkus kedua lengan berbeda/
    );
  });
});

describe("arah pengukuran", () => {
  // Inti perubahan c08a62c: metadata harus menyebut apa yang TERJADI dan untuk
  // APA, bukan cuma tampangnya. Kalau kedua pernyataan ini tertukar, laporannya
  // akan menyimpulkan kebalikan dari yang sebenarnya terjadi.
  const PENANDA_BARU = "what is HAPPENING";

  it("prompt sekarang meminta aksi lebih dulu", () => {
    expect(METADATA_GENERATOR_PROMPT_ADVANCED).toContain(PENANDA_BARU);
  });

  it("prompt lama tidak", () => {
    expect(bacaFixturePromptLama()).not.toContain(PENANDA_BARU);
  });
});

// ---------------------------------------------------------------------------
// Juri
// ---------------------------------------------------------------------------

const PUTUSAN_A_MENANG = {
  aksi: "A",
  kegunaan: "A",
  beli: "imbang",
  akurasi: "B",
  alasan: "A menyebut aksi menuang kopi.",
} as const;

describe("bacaPutusan", () => {
  it("membaca JSON polos", () => {
    const p = bacaPutusan(JSON.stringify(PUTUSAN_A_MENANG));
    expect(p.aksi).toBe("A");
    expect(p.beli).toBe("imbang");
    expect(p.alasan).toBe("A menyebut aksi menuang kopi.");
  });

  it("membaca JSON yang dibungkus pagar markdown", () => {
    const teks = "```json\n" + JSON.stringify(PUTUSAN_A_MENANG) + "\n```";
    expect(bacaPutusan(teks).akurasi).toBe("B");
  });

  it("galat kalau putusannya bukan A/B/imbang", () => {
    expect(() => bacaPutusan(JSON.stringify({ ...PUTUSAN_A_MENANG, aksi: "keduanya" }))).toThrow(
      /tidak dikenali/
    );
  });
});

describe("terjemahkanPutusan", () => {
  // Dua arah, karena inilah yang bisa tertukar tanpa suara.
  it("A = sekarang ketika sekarang yang jadi A", () => {
    const t = terjemahkanPutusan(bacaPutusan(JSON.stringify(PUTUSAN_A_MENANG)), true);
    expect(t).toEqual({
      aksi: "sekarang",
      kegunaan: "sekarang",
      beli: "imbang",
      akurasi: "lama",
    });
  });

  it("A = lama ketika lama yang jadi A", () => {
    const t = terjemahkanPutusan(bacaPutusan(JSON.stringify(PUTUSAN_A_MENANG)), false);
    expect(t).toEqual({
      aksi: "lama",
      kegunaan: "lama",
      beli: "imbang",
      akurasi: "sekarang",
    });
  });

  it("imbang tetap imbang di kedua acakan", () => {
    for (const sekarangJadiA of [true, false]) {
      const semuaImbang = bacaPutusan(
        JSON.stringify({ aksi: "imbang", kegunaan: "imbang", beli: "imbang", akurasi: "imbang", alasan: "" })
      );
      const t = terjemahkanPutusan(semuaImbang, sekarangJadiA);
      for (const k of KRITERIA) expect(t[k]).toBe("imbang");
    }
  });
});

describe("hitungPersen", () => {
  it("mengabaikan imbang di pembagi, bukan menghitungnya setengah", () => {
    const hasil = hitungPersen([
      { aksi: "sekarang", kegunaan: "imbang", beli: "lama", akurasi: "imbang" },
      { aksi: "sekarang", kegunaan: "imbang", beli: "lama", akurasi: "sekarang" },
      { aksi: "lama", kegunaan: "imbang", beli: "lama", akurasi: "imbang" },
    ]);
    expect(hasil.aksi).toEqual({ menang: 2, kalah: 1, imbang: 0, persen: 66.7 });
    expect(hasil.beli).toEqual({ menang: 0, kalah: 3, imbang: 0, persen: 0 });
    // Semua imbang: tidak ada persen yang boleh dikarang.
    expect(hasil.kegunaan).toEqual({ menang: 0, kalah: 0, imbang: 3, persen: null });
    expect(hasil.akurasi.persen).toBe(100);
  });

  it("tanpa putusan sama sekali, persennya null", () => {
    for (const k of KRITERIA) expect(hitungPersen([])[k].persen).toBeNull();
  });
});
