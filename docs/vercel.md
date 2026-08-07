# Deploy Nerona ke Vercel

Panduan deploy `nerona-web` ke Vercel. Untuk deploy ke VPS sendiri, lihat
`docs/production.md`.

Repo ini sudah menyertakan `vercel.json` (berisi **satu** cron harian — lihat batasan
nomor 2 di bawah), dan `package.json` sudah punya `postinstall: prisma generate` yang
wajib ada agar build Vercel berhasil.

---

## ⚠️ Baca dulu: dua batasan platform

Ini bukan bug di kode, tapi batas Vercel yang bersinggungan langsung dengan cara Nerona
bekerja. Putuskan ini **sebelum** deploy.

### 1. Limit ukuran request ±4,5 MB

Vercel Functions menolak request body di atas ±4,5 MB **sebelum** handler Anda jalan.
Sementara `src/app/api/extension/generate/route.ts` mengizinkan
`MAX_IMAGE_CHARS = 12_000_000` (12 MB base64).

Akibatnya gambar besar ditolak platform dengan 413 mentah, bukan error
`payload_too_large` milik Anda, sehingga extension hanya menampilkan pesan generik.

**Rekomendasi:** turunkan `MAX_IMAGE_CHARS` ke sekitar `4_000_000` supaya error Anda
sendiri yang muncul, dan idealnya perkecil gambar di sisi extension sebelum dikirim.
Base64 menambah ±33% ukuran, jadi gambar sumber ±3,3 MB saja sudah melewati batas.

### 2. Sweep job agent sudah dilepas dari cron Vercel

Plan **Hobby hanya mengizinkan cron harian**, jadi jadwal `*/5 * * * *` **menggagalkan
deploy** — bukan sekadar tidak jalan. Karena itu `vercel.json` sekarang hanya memuat
cron renewal yang harian:

```json
{
  "crons": [
    { "path": "/api/billing/renewals", "schedule": "0 1 * * *" }
  ]
}
```

**Yang hilang, dan yang tidak.** Balasan agent tetap normal: webhook memanggil
`runInBackground(processJob(...))` (`lib/agent/webhook-handler.ts`), jadi job diproses
saat pesan masuk, bukan oleh cron. Cron `*/5` hanya menjalankan `runStuckJobSweep()`,
yaitu jaring pengaman untuk job yang tersangkut lebih dari 2 menit — biasanya karena
function-nya mati di tengah jalan. Tanpa cron itu, job semacam itu **tetap tersangkut
sampai ada yang memanggil endpoint-nya**.

`/api/agent/cron` sendiri **tidak dihapus** dan masih berfungsi. Tiga cara memulihkan
sweep tanpa upgrade:

1. **Cron eksternal** (cron-job.org, GitHub Actions, atau crontab di mesin lain) memanggil
   endpoint tiap 5 menit dengan header `Authorization: Bearer $CRON_SECRET`. Tidak ada
   perubahan kode.
2. **Manual saat ada keluhan** — perintah curl di bagian "Setelah deploy" di bawah.
3. **Upgrade ke Pro**, lalu kembalikan entri ini ke `vercel.json`:
   `{ "path": "/api/agent/cron", "schedule": "*/5 * * * *" }`

Kalau job tersangkut sering terjadi, `docs/production.md` (VPS + worker sungguhan) lebih
cocok daripada menambal dengan polling.

Selain itu `maxDuration = 60` di route generate mengikuti limit plan — panggilan AI
vision pada gambar besar bisa memakan waktu.

> **Cron Vercel memakai UTC.** `0 1 * * *` = **08:00 WIB**, bukan 01:00 WIB. Kalau ingin
> renewal jalan dini hari WIB, ubah ke `0 18 * * *` (= 01:00 WIB hari berikutnya).

---

## 1. Siapkan database

Vercel tidak menyediakan disk persisten, jadi pakai Postgres managed (Supabase, Neon,
atau Vercel Postgres). Format di `.env.example` sudah mengikuti pola Supabase:

- `DATABASE_URL` → connection **pooled** (port 6543, `?pgbouncer=true`)
- `DIRECT_URL` → connection **langsung** (port 5432), dipakai untuk migrasi

Keduanya wajib. Prisma di serverless butuh pooler agar tidak menghabiskan koneksi.

---

## 2. Import project

1. Push repo ke GitHub (saat ini `nerona-web` **belum punya git remote**, jadi buat dulu).
2. Di Vercel: **Add New → Project → Import** repo tersebut.
3. Framework preset terdeteksi otomatis sebagai **Next.js**. Build command dan output
   biarkan default — `postinstall` akan menjalankan `prisma generate`.

---

## 3. Environment variables

Isi di **Settings → Environment Variables** (Production, dan Preview bila perlu).
Daftar ini diambil dari kode, bukan perkiraan.

### Wajib

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Postgres pooled |
| `DIRECT_URL` | Postgres langsung (migrasi) |
| `NEXTAUTH_URL` | `https://<project>.vercel.app` atau domain custom |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `CRON_SECRET` | `openssl rand -base64 32`. **Kalau kosong, endpoint cron menolak semua request (fail closed)** |
| `OWNER_ADMIN_EMAIL` | Email pemilik, dipakai script seed |

### Rilis (Nerona Hub & extension)

| Variabel | Keterangan |
| --- | --- |
| `RELEASE_SECRET` | `openssl rand -base64 32`. Dipakai CI kedua repo produk untuk mengisi sendiri kolom URL & versi di `/admin/pengaturan` sesudah rilis. **Kalau kosong, `/api/releases/publish` menolak semua request (fail closed)** |

Nilainya harus sama persis dengan secret `RELEASE_SECRET` di repo `nerona-hub`
dan `nerona_meta`. **Tambahkan env-nya lalu redeploy** — env baru tidak masuk ke
deploy yang sudah berjalan, dan gejalanya persis sama dengan nilai yang salah:
CI mendapat 401 setelah installer terlanjur terbit.

### AI (extension + agent)

| Variabel | Keterangan |
| --- | --- |
| `SUMOPOD_API_KEY` | Fallback bila key belum diisi di `/admin/pengaturan` (key di DB menang) |
| `SUMOPOD_BASE_URL` | Default `https://ai.sumopod.com/v1` |
| `AGENT_MODEL` | Fallback kode: `gemini-2.0-flash-lite` |
| `POINTS_PER_USD` | Fallback bila kosong di `/admin/pengaturan`. **Belum ada di `.env.example`** — default kode: `100000` |
| `AI_PRICE_IN` | USD / 1jt token input. Fallback `/admin/pengaturan`; default kode: `0.075` |
| `AI_PRICE_OUT` | USD / 1jt token output. Fallback `/admin/pengaturan`; default kode: `0.3` |

Tarif poin diatur dari `/admin/pengaturan` → Koneksi AI (DB → env → default kode).

### WhatsApp

`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_DISPLAY_NUMBER`

### Login & email

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`

---

## 4. Migrasi database

Build Vercel **tidak** menjalankan migrasi. `npm run db:migrate` juga tidak bisa dipakai
di sana karena script itu membaca `.env.local` lewat `dotenv`, sementara Vercel menyuntik
env lewat dashboard.

Jalankan migrasi dari mesin lokal, menunjuk ke database production:

```bash
DATABASE_URL="<url-production>" DIRECT_URL="<direct-url-production>" \
  npx prisma migrate deploy
```

Lalu seed owner admin **sekali saja**:

```bash
DATABASE_URL="<url-production>" DIRECT_URL="<direct-url-production>" \
  OWNER_ADMIN_EMAIL="you@example.com" npx tsx prisma/seed.ts
```

Ulangi `migrate deploy` setiap kali ada migrasi baru sebelum/saat deploy.

---

## 5. Deploy

Klik **Deploy**. Setelah selesai, cek:

- Halaman utama terbuka
- **Functions** memuat `/api/extension/generate`, `/api/extension/me`,
  `/api/extension/tokens`, `/api/whatsapp/webhook`
- **Settings → Cron Jobs** memuat satu entri dari `vercel.json`
  (`/api/billing/renewals`)

---

## 6. Setelah deploy

1. **Google OAuth** — tambahkan redirect URI di Google Cloud Console:
   `https://domain-anda.com/api/auth/callback/google`
2. **Webhook Meta** — Callback URL `https://domain-anda.com/api/whatsapp/webhook`,
   verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe field `messages`
3. **AI settings** di `/admin/pengaturan` — isi model + API key Sumopod.
   Model **wajib vision-capable**, karena extension mengirim gambar.
4. **Tarif AI** — isi tiga field tarif (harga input, harga output, poin per USD) di
   `/admin/pengaturan`. Tarif tidak lagi dipetakan per model; urutannya DB → env →
   `DEFAULT_AI_PRICING`. **Kalau ketiga field dikosongkan**, `DEFAULT_AI_PRICING` yang
   dipakai — nilainya sengaja dikalibrasi terhadap alokasi poin paket, dan ada test yang
   gagal kalau keduanya melenceng.
5. **Uji sweep job agent secara manual** — sekarang ini satu-satunya cara menjalankannya
   di Hobby (lihat batasan nomor 2):
   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" https://domain-anda.com/api/agent/cron
   # 200 {"ok":true,"swept":0}; tanpa header harus 401
   ```
   Pertimbangkan memasang cron eksternal yang memanggil ini tiap 5 menit.
6. **Update extension** (`nerona_medata`) lalu **bangun ulang paket unduhannya**:
   - `access/access-config.js` → `neronaWebBaseUrl: "https://domain-anda.com"`
   - `manifest.json` → hapus `http://localhost/*` dan `http://127.0.0.1/*` (opsional;
     `https://*/*` sudah mencakup produksi, entri localhost hanya untuk dev)
   - `powershell -ExecutionPolicy Bypass -File scripts/build-extension.ps1`

   **Langkah terakhir itu wajib setiap kali extension berubah.** `public/nerona-metadata.zip`
   adalah artefak yang ikut di-commit — Vercel tidak punya akses ke repo `nerona_medata`
   saat build, jadi ZIP tidak pernah dibangun otomatis. Kalau lupa, halaman Profile
   tetap menyajikan paket versi lama **tanpa tanda apa pun**. Skripnya memberi peringatan
   kalau base URL masih localhost, dan gagal keras kalau manifest merujuk berkas yang hilang.

   User memasangnya lewat **Load unpacked**, jadi tidak ada pembaruan otomatis di sisi
   mereka: setiap rilis baru mereka harus mengunduh ulang, menimpa folder, lalu klik
   Reload di `chrome://extensions`.
7. **Pastikan semua user extension aktif sudah ada di DB** dengan lisensi aktif —
   enforcement murni dari nerona-web, user yang tidak terdaftar langsung kehilangan akses.

---

## Masalah yang sudah diketahui (belum diperbaiki)

Berlaku di Vercel maupun VPS:

- **Belum ada smoke test browser** — alur connect token + generate belum pernah
  dijalankan sungguhan di browser.
- **Ukuran pesan `sendMessage`** — sejak perbaikan CORS, request generate (termasuk
  gambar base64) melewati `chrome.runtime.sendMessage` menuju service worker. Jalur ini
  sudah dipakai untuk mengambil gambar, tapi payload besar belum pernah diuji ke arah
  ini. Di Vercel batas 4,5 MB tetap yang mengikat lebih dulu.
- **API key tersimpan plaintext** di tabel `Setting`.
- **Kegagalan `spendPoints` ditelan** (`generate/route.ts`) — call AI langka bisa gratis.
- **Sweep job tersangkut tidak berjalan otomatis** di Hobby — lihat batasan nomor 2.
  (Catatan lama soal dua test `orders.test.ts` merah sudah tidak berlaku:
  `npm test` = 541 lulus, 0 gagal per 2026-07-29.)

---

## Kapan sebaiknya pindah ke VPS

Kalau salah satu ini benar, `docs/production.md` lebih cocok:

- Gambar yang dikirim extension sering mendekati atau melewati 4,5 MB
- Tidak mau membayar Pro hanya demi cron `*/5`
- Ingin memproses job agent dengan worker sungguhan, bukan polling cron
