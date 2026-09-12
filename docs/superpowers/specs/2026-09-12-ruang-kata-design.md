# Ruang Kata — beranda sebagai ruang kedalaman

Disetujui owner 2026-09-12. Mockup acuan: artefak "Nerona Ruang Kata" v6.

## Apa

Beranda `(marketing)/` berhenti menjadi tumpukan pita. Lima seksi yang ada
menjadi **lapisan** pada kedalaman 1 / 2,2 / 3,4 / 4,6 / 5,8 di dalam satu
panggung; gulir menggerakkan kamera **maju**. Di sekeliling lapisan, ±400 kata
kunci contoh melayang, berkelip, saling terhubung garis tipis, dan tidak pernah
melintasi area informasi.

## Keputusan

1. **Panggung `sticky`, bukan `fixed`.** Wadah setinggi `100vh + jarak tempuh`;
   panggung `position: sticky; top: <tinggi header>`. Header layout tetap;
   Footer asli muncul setelah wadah habis.
2. **Scope token `[data-surface="ruang"]`.** `--ink` putih, `--muted` navy-100,
   `--border/--divider` navy-500, `--accent` sky, `--emphasis` amber. Kartu
   putih memakai `.surface-light` (hanya berlaku di dalam ruang) untuk
   mengembalikan token terang. Markup seksi tidak diubah.
3. **Lima lapisan:** Hero (`dalamRuang`: tanpa Band, tanpa hujan kata),
   ProofSection, PricingTiers, FaqSection, CtaBanner. MarketplaceRow tidak ikut.
   `HeroKeywordRain` tetap untuk HomeMultiProduct.
4. **Ponsel (< lg) & reduced-motion:** satu fallback CSS: lapisan bertumpuk
   statis di atas navy, tanpa kanvas, tanpa mesin. Satu DOM, tanpa duplikasi.
   Tanpa JavaScript pun halaman terbaca utuh dalam bentuk ini.
5. **Lapisan yang lebih tinggi dari panggung** diskalakan agar muat saat fokus:
   `s × min(1, (H − 48) / tinggiLapisan)`.
6. **Aksesibilitas:** semua lapisan di DOM; `focusin` ke lapisan lain memicu
   selam ke sana; rel kedalaman = tombol berlabel; anchor `#pricing`/`#faq`
   dicegat dan diterjemahkan jadi selam. Kursor asli tidak disembunyikan.
7. **Yang dibuang dari mockup:** penunjuk "kedalaman 0,00" (tidak punya tujuan
   selain rasa ingin tahu); footer tiruan di lapisan penutup.
8. **Copy:** em dash di `Hero.tsx` dibersihkan (keputusan R-02).

## Angka (dari mockup v6)

F = 1 · NEAR 0,12 · FAR 7,5 · SPREAD 2,8 · 900px per satuan · 200 kata per sisi
· kedip ⅓ · garis: jangkau 240px, kedalaman sebanding ≥ 0,45, plafon alfa 0,38
· lapisan tampak s 0,46 → 2,6 · pelunakan kamera 0,085.

## Berkas

- Baru: `src/lib/ruang.ts` (matematika murni) + `tests/lib/ruang.test.ts`;
  `src/components/marketing/ruang/RuangKata.tsx`, `Lapisan.tsx`.
- Ubah: `globals.css`, `Band` (tone `ruang`), `Card` & `MetadataCardMockup`
  (`surface-light`), `Hero` (`dalamRuang`), `ProofSection` & `CtaBanner`
  (prop `tone`), `HomeMetadataOnly`.

## Bukti penyerahan

vitest untuk `lib/ruang`; build; potret 1920/1440/1280/1024/390; klik-tembus
nav, rel, tombol hero, anchor; konsol bersih; laporan Delivery Gate antislop.
