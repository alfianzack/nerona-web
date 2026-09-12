/**
 * Matematika Ruang Kata — murni, tanpa DOM, supaya bisa diuji tanpa peramban.
 *
 * Satu proyeksi perspektif dipakai dua pihak: kata di kanvas dan lapisan DOM.
 * Karena keduanya membaca fungsi yang sama, kata benar-benar lewat DI SEKITAR
 * lapisan, bukan di dunia paralel yang kebetulan mirip.
 */

export const RUANG = {
  /** Jarak fokus: lapisan tajam dan berskala 1 saat dz = F. */
  F: 1,
  NEAR: 0.12,
  FAR: 7.5,
  /** Sebaran x kata dalam satuan setengah-panggung. Jauh lebih lebar dari
   *  bidang isi (±1) supaya kata jauh pun jatuh di pinggir, bukan di belakang
   *  teks — di sana ia disembunyikan dan yang tergambar tinggal segelintir. */
  SPREAD: 2.8,
  /** Satu satuan kedalaman = sekian piksel gulir. */
  PX_PER_UNIT: 900,
  /** Kedalaman kelima lapisan beranda. */
  LAPISAN_Z: [1, 2.2, 3.4, 4.6, 5.8] as const,
  /** Pelunakan kamera per bingkai. */
  PELUNAKAN: 0.085,
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Skala perspektif sebuah titik pada jarak dz dari kamera. */
export function proyeksi(dz: number, f: number = RUANG.F): number {
  return f / dz;
}

/** Jarak tempuh kamera: berhenti tepat saat lapisan terakhir difokus. */
export function jarakTempuh(lapisanZ: readonly number[], f: number = RUANG.F): number {
  return lapisanZ[lapisanZ.length - 1] - f;
}

export function kedalamanKeGulir(z: number, f = RUANG.F, px = RUANG.PX_PER_UNIT): number {
  return (z - f) * px;
}

export function gulirKeKedalaman(y: number, tempuh: number, px = RUANG.PX_PER_UNIT): number {
  return Math.min(tempuh, Math.max(0, y / px));
}

/**
 * Ruang yang melingkar DUA arah. Kata yang lewat di belakang kamera dipindah
 * satu panjang ruang ke depan; yang terlalu jauh di depan dipindah ke belakang.
 * Versi satu arah (lempar ke depan saja) membuat ruang kosong begitu pengguna
 * menggulir balik — terbukti di mockup v1.
 * Mengembalikan z baru, dan `dilipat` = true kalau posisinya berubah.
 */
export function lipatKedalaman(
  z: number,
  cam: number,
  near = RUANG.NEAR,
  far = RUANG.FAR,
): { z: number; dilipat: boolean } {
  const panjang = far - near;
  const dz = z - cam;
  if (dz < near) return { z: z + panjang * Math.ceil((near - dz) / panjang), dilipat: true };
  if (dz > far) return { z: z - panjang * Math.ceil((dz - far) / panjang), dilipat: true };
  return { z, dilipat: false };
}

/** Alfa dasar kata: muncul dari kejauhan, memucat lagi saat menabrak kamera. */
export function alfaKata(dz: number, near = RUANG.NEAR, far = RUANG.FAR): number {
  const jauh = clamp01((far - dz) / 2.2);
  const dekat = clamp01((dz - near) / 0.35);
  return 0.42 * jauh * dekat;
}

export type KeadaanLapisan = {
  tampak: boolean;
  /** Skala CSS yang dipakai, sudah dikali faktor muat. */
  skala: number;
  alfa: number;
  /** Radius blur px; 0 = tajam. */
  kabur: number;
  /** Boleh menerima pointer/keyboard. */
  fokus: boolean;
  /** |ln s| — 0 tepat di fokus; dipakai memilih lapisan aktif. */
  jarakFokus: number;
};

/**
 * Keadaan sebuah lapisan pada jarak dz dari kamera.
 *
 * Tampak antara s 0,46 → 2,6, penuh sekitar 0,8–1,25. Ambang masuk 0,46 bukan
 * lebih rendah: lapisan berikutnya saat kamera diam berada di s ≈ 0,45, dan di
 * bawah ambang itu ia sudah membayang tepat di belakang judul lapisan yang
 * sedang dibaca (terlihat di potret mockup v1).
 *
 * `faktorMuat` mengecilkan lapisan yang lebih tinggi dari panggungnya supaya
 * seluruhnya terlihat saat fokus; ia TIDAK memengaruhi alfa/kabur/fokus, yang
 * tetap dihitung dari s murni.
 */
export function keadaanLapisan(dz: number, faktorMuat = 1, f = RUANG.F): KeadaanLapisan {
  if (dz <= 0.05) return { tampak: false, skala: 0, alfa: 0, kabur: 0, fokus: false, jarakFokus: Infinity };
  const s = f / dz;
  const masuk = clamp01((s - 0.46) / 0.36);
  const keluar = clamp01((2.6 - s) / 1.35);
  const alfa = Math.min(masuk, keluar);
  const jarakFokus = Math.abs(Math.log(s));
  const kabur = Math.min(8, Math.max(0, jarakFokus - 0.18) * 7);
  return {
    tampak: alfa > 0,
    skala: s * faktorMuat,
    alfa,
    kabur: kabur > 0.3 ? kabur : 0,
    fokus: alfa > 0.6 && s > 0.75 && s < 1.4,
    jarakFokus,
  };
}

/** Faktor muat: 1 kalau lapisan muat di panggung, lebih kecil kalau tidak. */
export function faktorMuat(tinggiLapisan: number, tinggiPanggung: number, margin = 48): number {
  if (tinggiLapisan <= 0) return 1;
  return Math.min(1, (tinggiPanggung - margin) / tinggiLapisan);
}

export type Kotak = { left: number; right: number; top: number; bottom: number };

/** Jarak Euclid terdekat dari titik ke salah satu kotak; 0 di dalam. */
export function jarakKeKotak(x: number, y: number, kotak: readonly Kotak[]): number {
  let d = Infinity;
  for (const k of kotak) {
    const dx = Math.max(k.left - x, 0, x - k.right);
    const dy = Math.max(k.top - y, 0, y - k.bottom);
    d = Math.min(d, Math.hypot(dx, dy));
  }
  return d;
}

/**
 * Alfa garis rasi antara dua kata. Hanya kata yang berdekatan di layar DAN
 * sebanding kedalamannya yang terhubung, supaya yang terhubung terbaca sebagai
 * satu gugus. Plafon 0,38 dan tetap 1px: "tipis" ada di tebalnya, bukan di
 * kecerahannya — garis sepucat katanya sendiri tidak pernah terbaca.
 */
export function alfaGaris(
  jarak: number,
  jangkau: number,
  alfaA: number,
  alfaB: number,
  pA: number,
  pB: number,
): number {
  if (jarak > jangkau || jarak < 18) return 0;
  const sebanding = Math.min(pA, pB) / Math.max(pA, pB);
  if (sebanding < 0.45) return 0;
  const a = Math.min(0.38, (1 - jarak / jangkau) * Math.min(alfaA, alfaB) * sebanding * 1.7);
  return a < 0.015 ? 0 : a;
}

/**
 * Sudut gambar dilipat ke (−90°, 90°]. Dipakai kalau suatu saat kata diberi
 * putaran; di ruang ini kata tidak berputar, tapi fungsinya sudah dibutuhkan
 * hujan kata dan pantas satu tempat.
 */
export function lipatSudut(rad: number): number {
  let a = rad % Math.PI;
  if (a > Math.PI / 2) a -= Math.PI;
  else if (a <= -Math.PI / 2) a += Math.PI;
  return a;
}
