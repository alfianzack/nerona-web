import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUARD_RULES,
  KEY_GUARD_RULES,
  parseGuardRules
} from "@/lib/extension/guard-rules";

/**
 * Uji penahan untuk aturan penjaga unggahan.
 *
 * Angka bawaan di sini HARUS sama persis dengan `nerona_medata/guard/aturan.js`.
 * Tanpa bundler, dua salinan itu tidak bisa disatukan jadi satu berkas, jadi
 * yang menjaganya cuma dua berkas uji yang memaku angka yang sama:
 * scripts/guard-aturan.test.mjs di sisi extension, dan berkas ini di sisi
 * server. Kalau salah satu digeser, salah satunya merah.
 *
 * Angkanya sendiri bukan karangan: semuanya disalin dari batas yang sudah hidup
 * di prompt produksi (src/lib/extension/prompts.ts, bagian "MARKETPLACE LIMITS"
 * dan penambah Vecteezy serta Miricanvas di buildMetadataPrompt).
 */
describe("aturan bawaan", () => {
  it("kunci Setting-nya tetap, karena sudah dipakai ekstensi yang beredar", () => {
    expect(KEY_GUARD_RULES).toBe("extension_guard_rules");
  });

  it("profil umum mengikuti Adobe: judul 120, 40 keyword, frasa 4 kata", () => {
    expect(DEFAULT_GUARD_RULES.umum.judulMaks).toBe(120);
    expect(DEFAULT_GUARD_RULES.umum.keywordMaks).toBe(40);
    expect(DEFAULT_GUARD_RULES.umum.kataMaksPerKeyword).toBe(4);
  });

  it("Canva: judul 64, 20 keyword, frasa 3 kata, dan kata canva dilarang", () => {
    const canva = DEFAULT_GUARD_RULES.perMarketplace.canva;
    expect(canva.judulMaks).toBe(64);
    expect(canva.keywordMaks).toBe(20);
    expect(canva.kataMaksPerKeyword).toBe(3);
    expect(canva.kataTerlarang).toContain("canva");
  });

  it("Vecteezy cuma menerima tag satu kata", () => {
    expect(DEFAULT_GUARD_RULES.perMarketplace.vecteezy.kataMaksPerKeyword).toBe(1);
    expect(DEFAULT_GUARD_RULES.perMarketplace.vecteezy.keywordMaks).toBe(50);
  });

  it("Miricanvas: nama 100 karakter, 25 tag", () => {
    expect(DEFAULT_GUARD_RULES.perMarketplace.miricanvas.judulMaks).toBe(100);
    expect(DEFAULT_GUARD_RULES.perMarketplace.miricanvas.keywordMaks).toBe(25);
  });

  it("bobot skor berjumlah 100 supaya totalnya terbaca sebagai persen", () => {
    const b = DEFAULT_GUARD_RULES.bobot;
    expect(b.relevansi + b.keunikan + b.bentuk + b.kepatuhan).toBe(100);
  });
});

describe("parseGuardRules", () => {
  it("tanpa baris Setting, memakai bawaan dan menandai versinya", () => {
    const a = parseGuardRules(undefined);
    expect(a.versi).toBe("bawaan");
    expect(a.umum.judulMaks).toBe(120);
  });

  it("JSON rusak tidak melempar, cuma jatuh ke bawaan", () => {
    expect(() => parseGuardRules("{ bukan json")).not.toThrow();
    expect(parseGuardRules("{ bukan json").versi).toBe("bawaan");
  });

  it("JSON yang sah tapi bukan objek juga jatuh ke bawaan", () => {
    expect(parseGuardRules("[1,2,3]").versi).toBe("bawaan");
    expect(parseGuardRules("\"teks\"").versi).toBe("bawaan");
  });

  it("menimpa satu bidang, sisanya tetap bawaan", () => {
    const a = parseGuardRules(JSON.stringify({ versi: "2026-09-17.1", umum: { keywordMaks: 49 } }));
    expect(a.versi).toBe("2026-09-17.1");
    expect(a.umum.keywordMaks).toBe(49);
    expect(a.umum.judulMaks).toBe(120);
  });

  it("angka yang tidak masuk akal diabaikan, bukan diteruskan ke ekstensi", () => {
    const a = parseGuardRules(
      JSON.stringify({ versi: "v2", umum: { judulMaks: 0, keywordMaks: -1, kataMaksPerKeyword: "empat" } })
    );
    expect(a.umum.judulMaks).toBe(120);
    expect(a.umum.keywordMaks).toBe(40);
    expect(a.umum.kataMaksPerKeyword).toBe(4);
  });

  it("kata terlarang diturunkan hurufnya, yang bukan teks dibuang", () => {
    const a = parseGuardRules(JSON.stringify({ versi: "v2", umum: { kataTerlarang: ["Free", 7, null, "  ", "AI"] } }));
    expect(a.umum.kataTerlarang).toEqual(["free", "ai"]);
  });

  it("marketplace baru boleh ditambah owner tanpa menunggu rilis kode", () => {
    const a = parseGuardRules(
      JSON.stringify({ versi: "v2", perMarketplace: { "123rf": { keywordMaks: 50 } } })
    );
    expect(a.perMarketplace["123rf"].keywordMaks).toBe(50);
  });

  it("kunci marketplace diturunkan hurufnya supaya cocok dengan ekstensi", () => {
    const a = parseGuardRules(JSON.stringify({ versi: "v2", perMarketplace: { CANVA: { keywordMaks: 22 } } }));
    expect(a.perMarketplace.canva.keywordMaks).toBe(22);
  });

  it("bobot dari owner dipakai, tapi yang tidak masuk akal ditolak seluruhnya", () => {
    const sah = parseGuardRules(
      JSON.stringify({ versi: "v2", bobot: { relevansi: 50, keunikan: 20, bentuk: 10, kepatuhan: 20 } })
    );
    expect(sah.bobot.relevansi).toBe(50);

    const nol = parseGuardRules(
      JSON.stringify({ versi: "v2", bobot: { relevansi: 0, keunikan: 0, bentuk: 0, kepatuhan: 0 } })
    );
    expect(nol.bobot).toEqual(DEFAULT_GUARD_RULES.bobot);
  });

  it("ambang jarak duplikat dan ambang poin jeda ikut bisa disetel", () => {
    const a = parseGuardRules(JSON.stringify({ versi: "v2", duplikatAmbang: 6, ambangPoinJeda: 250 }));
    expect(a.duplikatAmbang).toBe(6);
    expect(a.ambangPoinJeda).toBe(250);
  });

  it("ambang duplikat di luar 0 sampai 64 ditolak, karena sidiknya 64 bit", () => {
    expect(parseGuardRules(JSON.stringify({ versi: "v2", duplikatAmbang: 99 })).duplikatAmbang).toBe(
      DEFAULT_GUARD_RULES.duplikatAmbang
    );
  });

  it("hasilnya tidak berbagi acuan dengan bawaan, jadi tidak bisa dicemari", () => {
    const a = parseGuardRules(undefined);
    a.umum.kataTerlarang.push("bocor");
    expect(parseGuardRules(undefined).umum.kataTerlarang).not.toContain("bocor");
  });
});
