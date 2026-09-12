import { describe, expect, it } from "vitest";
import {
  RUANG,
  alfaGaris,
  alfaKata,
  faktorMuat,
  gulirKeKedalaman,
  jarakKeKotak,
  jarakTempuh,
  keadaanLapisan,
  kedalamanKeGulir,
  lipatKedalaman,
  lipatSudut,
  proyeksi,
} from "@/lib/ruang";

describe("proyeksi & gulir", () => {
  it("skala 1 tepat di jarak fokus, mengecil menjauh", () => {
    expect(proyeksi(RUANG.F)).toBe(1);
    expect(proyeksi(2)).toBe(0.5);
  });

  it("kamera berhenti tepat saat lapisan terakhir difokus", () => {
    expect(jarakTempuh(RUANG.LAPISAN_Z)).toBeCloseTo(4.8);
  });

  it("kedalaman ↔ gulir saling membalik dan dijepit ke jarak tempuh", () => {
    const tempuh = jarakTempuh(RUANG.LAPISAN_Z);
    for (const z of RUANG.LAPISAN_Z) {
      expect(gulirKeKedalaman(kedalamanKeGulir(z), tempuh)).toBeCloseTo(z - RUANG.F);
    }
    expect(gulirKeKedalaman(-500, tempuh)).toBe(0);
    expect(gulirKeKedalaman(1e9, tempuh)).toBe(tempuh);
  });
});

describe("lipatKedalaman — ruang melingkar dua arah", () => {
  const panjang = RUANG.FAR - RUANG.NEAR;

  it("kata di belakang kamera dipindah satu panjang ruang ke depan", () => {
    const r = lipatKedalaman(1.0, 1.5);
    expect(r.dilipat).toBe(true);
    expect(r.z).toBeCloseTo(1.0 + panjang);
    expect(r.z - 1.5).toBeGreaterThanOrEqual(RUANG.NEAR);
  });

  it("kata terlalu jauh di depan dipindah ke belakang (menggulir balik)", () => {
    const r = lipatKedalaman(9, 0);
    expect(r.dilipat).toBe(true);
    expect(r.z).toBeCloseTo(9 - panjang);
    expect(r.z).toBeLessThanOrEqual(RUANG.FAR);
  });

  it("kata di dalam ruang tidak disentuh", () => {
    expect(lipatKedalaman(3, 0)).toEqual({ z: 3, dilipat: false });
  });

  it("lompatan kamera besar tetap kembali ke dalam ruang dalam satu kali lipat", () => {
    const r = lipatKedalaman(0.5, 40);
    expect(r.z - 40).toBeGreaterThanOrEqual(RUANG.NEAR);
    expect(r.z - 40).toBeLessThanOrEqual(RUANG.FAR + 1e-9);
  });
});

describe("keadaanLapisan", () => {
  it("lapisan di fokus: skala 1, alfa 1, tajam, menerima input", () => {
    const k = keadaanLapisan(RUANG.F);
    expect(k.skala).toBe(1);
    expect(k.alfa).toBe(1);
    expect(k.kabur).toBe(0);
    expect(k.fokus).toBe(true);
  });

  it("lapisan berikutnya saat kamera diam TIDAK membayang di belakang judul", () => {
    // Hero difokus (cam = 0); lapisan kedua berjarak 2,2 → s ≈ 0,4545 < 0,46.
    const k = keadaanLapisan(RUANG.LAPISAN_Z[1] - 0);
    expect(k.alfa).toBe(0);
    expect(k.tampak).toBe(false);
  });

  it("lapisan yang sudah dilewati kamera hilang", () => {
    expect(keadaanLapisan(0.02).tampak).toBe(false);
    expect(keadaanLapisan(-1).tampak).toBe(false);
  });

  it("faktor muat mengecilkan skala tanpa mengubah alfa dan fokus", () => {
    const penuh = keadaanLapisan(RUANG.F, 1);
    const muat = keadaanLapisan(RUANG.F, 0.6);
    expect(muat.skala).toBeCloseTo(0.6);
    expect(muat.alfa).toBe(penuh.alfa);
    expect(muat.fokus).toBe(penuh.fokus);
  });

  it("jarakFokus nol di fokus dan simetris untuk s dan 1/s", () => {
    expect(keadaanLapisan(1).jarakFokus).toBe(0);
    expect(keadaanLapisan(2).jarakFokus).toBeCloseTo(keadaanLapisan(0.5).jarakFokus);
  });
});

describe("faktorMuat", () => {
  it("1 kalau lapisan muat, mengecil proporsional kalau tidak", () => {
    expect(faktorMuat(500, 900)).toBe(1);
    expect(faktorMuat(1200, 900)).toBeCloseTo((900 - 48) / 1200);
    expect(faktorMuat(0, 900)).toBe(1);
  });
});

describe("jarakKeKotak", () => {
  const kotak = [{ left: 100, right: 200, top: 100, bottom: 200 }];
  it("nol di dalam kotak dan di tepinya", () => {
    expect(jarakKeKotak(150, 150, kotak)).toBe(0);
    expect(jarakKeKotak(100, 150, kotak)).toBe(0);
  });
  it("jarak tegak lurus di luar sisi, diagonal di luar sudut", () => {
    expect(jarakKeKotak(250, 150, kotak)).toBe(50);
    expect(jarakKeKotak(230, 240, kotak)).toBeCloseTo(50);
  });
  it("tanpa kotak = tak terhingga (tidak pernah meredupkan)", () => {
    expect(jarakKeKotak(0, 0, [])).toBe(Infinity);
  });
});

describe("alfaKata & alfaGaris", () => {
  it("kata: nol di NEAR dan FAR, positif di tengah", () => {
    expect(alfaKata(RUANG.NEAR)).toBe(0);
    expect(alfaKata(RUANG.FAR)).toBe(0);
    expect(alfaKata(2)).toBeGreaterThan(0.3);
  });

  it("garis: hanya kata berdekatan & sebanding kedalamannya, plafon 0,38", () => {
    expect(alfaGaris(300, 240, 0.4, 0.4, 1, 1)).toBe(0);
    expect(alfaGaris(10, 240, 0.4, 0.4, 1, 1)).toBe(0);
    expect(alfaGaris(60, 240, 0.4, 0.4, 1, 0.3)).toBe(0);
    expect(alfaGaris(30, 240, 1, 1, 1, 1)).toBe(0.38);
    const a = alfaGaris(120, 240, 0.4, 0.4, 1, 1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(0.38);
  });
});

describe("lipatSudut", () => {
  it("melipat ke (−90°, 90°]", () => {
    expect(lipatSudut(0)).toBe(0);
    expect(lipatSudut(Math.PI)).toBeCloseTo(0);
    expect(lipatSudut(Math.PI * 0.75)).toBeCloseTo(-Math.PI * 0.25);
    expect(lipatSudut(-Math.PI * 0.75)).toBeCloseTo(Math.PI * 0.25);
  });
});
