# nerona-web

Next.js 14 (App Router) + Prisma (Supabase Postgres) + Tailwind + NextAuth.
Aturan payung ada di `../CLAUDE.md`; berkas ini hanya yang khusus repo ini.

## Peta

- `src/app/(marketing)` publik, `(auth)`, `(app)` tenant, `(admin)`; `api/`.
- Shell aplikasi: `src/components/layout/AppShell.tsx` (sidebar navy, tanpa
  topbar; bar tipis hanya `< sm`).
- Beranda: `src/components/marketing/home/HomeMetadataOnly.tsx` (lima seksi).
- Token: `src/app/globals.css` (`:root` = Presisi/aplikasi,
  `[data-surface="marketing"]` = Bening/publik). Skala: `tailwind.config.ts`.
- Arah visual untuk antislop: `DESIGN.md` di folder ini.

## Perintah

- `npm run build` · `npx vitest run` (pakai `--reporter=json --outputFile`
  untuk ringkasan yang terbaca; `npm run test` segfault di akhir, itu npm).
- `npm run lint` tidak jalan di repo ini.
- `npx tsc --noEmit -p tsconfig.json | grep -v "^tests/"` untuk cek `src/`;
  error `VitestUtils` di `tests/` sudah ada sebelumnya.
- **AWAS:** `.env.local` menunjuk Supabase PRODUKSI. `prisma:migrate` mengubah
  produksi langsung. Menjalankan `next start` membaca DB produksi (baca saja).

## Yang sudah diketahui rusak dan bukan tugas Anda memperbaikinya diam-diam

- `tests/lib/orders.test.ts`: 2 tes gagal karena tanggal hardcoded
  `2026-09-30` kedaluwarsa. Pre-existing; perbaiki hanya bila diminta.
- `lib/nav.ts:pageTitle()` tidak dipakai UI lagi, disimpan bersama tesnya atas
  keputusan owner.

## Kebiasaan kode yang harus diikuti

- Komentar dan docblock berbahasa Indonesia, menjelaskan **sebab** keputusan
  (sering dengan angka yang terukur), bukan mengulang kode. Pertahankan
  kepadatannya; jangan hapus docblock lama saat menyunting.
- Warna dan radius lewat token Tailwind (`bg-navy-900`, `rounded-card`), bukan
  hex lepas. Nilai baru masuk `globals.css` dulu.
- `cn()` bukan tailwind-merge: `className` yang menimpa utilitas komponen
  diselesaikan urutan CSS, bukan urutan tulis. Jangan andalkan itu.
- Utilitas `ring-*` Tailwind adalah `box-shadow`; `style.boxShadow` inline
  menimpanya diam-diam. Pakai `border` kalau ada bayangan inline.
- Pemindai Tailwind membaca komentar: jangan sebut nama kelas yang sengaja
  dibuang di dalam komentar.
- Halaman statis (`○`) di sini JS-nya diblokir CSP (nonce per respons). Halaman
  aplikasi semuanya `ƒ`; harness screenshot apa pun wajib
  `export const dynamic = "force-dynamic"`.
- Kata kunci contoh berasal dari `src/lib/marketing-keywords.ts`; jangan salin
  daftarnya ke tempat lain.
- Prompt metadata (`src/lib/extension/prompts.ts`) tidak diubah sebagai efek
  samping pekerjaan lain; ada tes emas yang memakunya.

## Copy

- Tanpa em dash di copy UI (antislop R-02, dipatuhi penuh). Berkas UI yang
  disentuh: bersihkan em dash di copy berkas itu sekalian. Docblock bebas.
- Angka di halaman publik berasal dari registry/DB (`CLAIMABLE_MARKETPLACES`,
  `metadataTiers`, `defaultModelPointsPerImage`), tidak ditulis tangan.

## Verifikasi visual

`playwright-core` tidak ada di repo; pakai yang ada di scratchpad sesi atau
pasang sementara, jalankan Chrome terpasang
(`C:/Program Files/Google/Chrome/Application/chrome.exe`), server di port
kosong (EADDRINUSE menyajikan build basi tanpa peringatan). Ukur, jangan
menebak dari gambar.
