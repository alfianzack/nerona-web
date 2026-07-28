# Deploy Nerona ke VPS (Production)

Panduan lengkap menjalankan `nerona-web` di VPS sendiri (Ubuntu) — 24 jam, tanpa
batasan platform serverless.

> Dokumen ini **menggantikan** `docs/DEPLOY-VPS.md` (versi lama hanya memuat satu dari
> dua cron dan belum menyebut beberapa env var). Untuk deploy ke Vercel, lihat
> `docs/vercel.md`.

File bantu yang sudah ada di repo: `ecosystem.config.js` (PM2), `Caddyfile` (HTTPS),
`deploy.sh` (skrip deploy).

---

## Kenapa VPS cocok untuk Nerona

| Kebutuhan Nerona | Di VPS | Di Vercel |
| --- | --- | --- |
| Upload gambar ke `/api/extension/generate` (cap kode 12 MB base64) | Bebas | **Dibatasi ±4,5 MB** oleh platform |
| Cron `*/5` untuk sweep job agent | Bebas (crontab) | Butuh plan **Pro** |
| Durasi request AI vision (`maxDuration = 60`) | Bebas | Ikut limit plan |
| Prisma connection pool | Persisten, sehat | Perlu pooler + rawan cold start |
| Background `waitUntil` | Tetap jalan (proses Node hidup) | Jalan |

Konsekuensinya: TLS, backup, patching, dan monitoring jadi tanggung jawab Anda.

---

## 1. Prasyarat di VPS

```bash
# Node 20 (via nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# PM2 (process manager)
sudo npm i -g pm2

# Caddy (reverse proxy + HTTPS otomatis)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

**Set timezone server ke WIB** supaya jadwal crontab sesuai jam lokal:

```bash
sudo timedatectl set-timezone Asia/Jakarta
timedatectl   # verifikasi
```

Database: Postgres 15/16 (lokal di VPS atau managed seperti Supabase/Neon).

---

## 2. Ambil kode

```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone <URL_REPO> nerona-web
cd nerona-web
```

---

## 3. Environment variables

Buat `.env.local` di server. Daftar lengkap (diambil dari kode, bukan perkiraan):

### Wajib

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string Postgres. Di VPS dengan Postgres lokal, boleh sama dengan `DIRECT_URL` |
| `DIRECT_URL` | Dipakai Prisma untuk migrasi |
| `NEXTAUTH_URL` | `https://domain-anda.com` (harus https) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `CRON_SECRET` | `openssl rand -base64 32`. **Kalau kosong, endpoint cron menolak semua request (fail closed)** |
| `OWNER_ADMIN_EMAIL` | Email pemilik; dipakai `prisma/seed.ts` untuk membuat role `owner_admin` |

### AI (extension + agent)

| Variabel | Keterangan |
| --- | --- |
| `SUMOPOD_API_KEY` | Fallback kalau key belum diisi lewat `/admin/pengaturan`. Key di DB menang |
| `SUMOPOD_BASE_URL` | Default `https://ai.sumopod.com/v1` kalau kosong |
| `AGENT_MODEL` | Model default kalau belum diset di `/admin/pengaturan`. Fallback kode: `gemini-2.0-flash-lite` |
| `POINTS_PER_USD` | Kurs poin. Fallback kalau belum diset di `/admin/pengaturan`. **Belum ada di `.env.example`** — default kode: `100000` |
| `AI_PRICE_IN` | Harga USD per 1jt token input. Fallback `/admin/pengaturan`; default kode: `0.075` |
| `AI_PRICE_OUT` | Harga USD per 1jt token output. Fallback `/admin/pengaturan`; default kode: `0.3` |

Tarif poin (`AI_PRICE_IN`/`AI_PRICE_OUT`/`POINTS_PER_USD`) sekarang diatur dari
`/admin/pengaturan` → Koneksi AI. Urutan: nilai di DB → env → default kode. Ketiga env
var di atas hanya dipakai kalau kolomnya dikosongkan di admin.

### WhatsApp (Meta Cloud API)

`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_DISPLAY_NUMBER`

### Login & email

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`

> Di Google Cloud Console tambahkan redirect URI:
> `https://domain-anda.com/api/auth/callback/google`

---

## 4. Sesuaikan file bantu

- `ecosystem.config.js` → pastikan `cwd` = `/var/www/nerona-web`
- `Caddyfile` → ganti `domain-anda.com` dengan domain Anda (A record sudah mengarah ke IP VPS)

**Catatan Caddy:** secara default Caddy tidak membatasi ukuran request body dan
timeout-nya longgar, jadi payload gambar 12 MB aman tanpa konfigurasi tambahan.

**Kalau memakai nginx (bukan Caddy)**, dua baris ini wajib — tanpa itu upload gambar
gagal dengan 413 dan call AI panjang terputus:

```nginx
client_max_body_size 16m;
proxy_read_timeout   120s;
```

---

## 5. Deploy pertama

```bash
bash deploy.sh          # git pull → npm install → migrate → build → pm2 reload
npm run prisma:seed     # sekali saja, membuat owner admin dari OWNER_ADMIN_EMAIL
pm2 startup             # ikuti perintah yang muncul agar auto-start saat reboot
pm2 save
```

Aktifkan HTTPS:

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Cek `https://domain-anda.com` terbuka dengan gembok hijau.

---

## 6. Crontab — WAJIB, dua entri

`vercel.json` tidak dibaca di VPS. Ada **dua** cron yang harus dipindah ke crontab
sistem. Versi lama dokumen ini hanya memuat yang pertama; tanpa yang kedua,
**auto-renew paket bulanan tidak akan pernah jalan.**

```bash
crontab -e
```

```cron
# Sweep job agent yang tersangkut — tiap 5 menit
*/5 * * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET" https://domain-anda.com/api/agent/cron > /dev/null

# Renewal / invoice bulanan — 01:00 WIB (server sudah di-set Asia/Jakarta)
0 1 * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET" https://domain-anda.com/api/billing/renewals > /dev/null
```

Uji manual sebelum menganggap beres:

```bash
curl -i -H "Authorization: Bearer ISI_CRON_SECRET" https://domain-anda.com/api/agent/cron
# harus 200 {"ok":true,...}; tanpa header harus 401
```

---

## 7. Webhook WhatsApp (Meta)

- Callback URL: `https://domain-anda.com/api/whatsapp/webhook`
- Verify token: sama persis dengan `WHATSAPP_VERIFY_TOKEN`
- Subscribe field: `messages`

---

## 8. Setelah deploy — jangan dilewat

1. **Isi AI settings** di `/admin/pengaturan`: model + API key Sumopod.
   Pastikan modelnya **vision-capable** — extension mengirim gambar. Model non-vision
   akan gagal di semua fitur metadata.
2. **Isi tarif poin** di `/admin/pengaturan` → Koneksi AI: harga input & output (USD per
   1jt token, sesuai harga model yang dipakai) dan poin per USD. Kalau dikosongkan,
   yang dipakai adalah env (`AI_PRICE_IN`/`AI_PRICE_OUT`/`POINTS_PER_USD`), lalu default
   kode (tarif `gemini-2.0-flash-lite`) — jadi memakai model mahal tanpa mengisi tarif
   berarti poin tenant **kurang terpotong**.
3. **Update extension** (`nerona_medata`):
   - `access/access-config.js` → `neronaWebBaseUrl: "https://domain-anda.com"`
   - `manifest.json` → hapus `http://localhost/*` dan `http://127.0.0.1/*`
4. **Pastikan semua user extension aktif sudah ada di DB** dengan lisensi aktif —
   enforcement sekarang murni dari nerona-web, user yang tidak terdaftar langsung
   kehilangan akses.

---

## 9. Update berikutnya

```bash
cd /var/www/nerona-web
bash deploy.sh
```

Kalau ada perubahan schema Prisma, `deploy.sh` sudah menjalankan `npm run db:migrate`
(= `prisma migrate deploy`).

---

## 10. Backup

**Penting:** bukti transfer pembayaran disimpan sebagai kolom `proofImage Bytes?` di
Postgres, bukan di object storage. Ukuran database akan tumbuh cepat dan dump ikut
membengkak.

```bash
# contoh dump harian
pg_dump "$DATABASE_URL" | gzip > /backup/nerona-$(date +\%F).sql.gz
```

Pertimbangkan memindahkan blob ke object storage kalau volume order sudah tinggi.

---

## Perintah berguna

```bash
pm2 logs nerona              # log aplikasi
pm2 restart nerona           # restart manual
pm2 monit                    # monitor CPU/RAM
sudo journalctl -u caddy -f  # log Caddy/HTTPS
```

---

## Masalah yang sudah diketahui (belum diperbaiki)

Berlaku di VPS maupun Vercel:

- **Belum ada smoke test browser** — alur connect token + generate belum pernah
  dijalankan sungguhan di browser.
- **Ukuran pesan `sendMessage`** — sejak perbaikan CORS, request generate (termasuk
  gambar base64) melewati `chrome.runtime.sendMessage` menuju service worker. Jalur ini
  sudah dipakai untuk mengambil gambar, tapi payload besar (mendekati 12 MB) belum
  pernah diuji ke arah ini. Perkecil gambar di sisi extension kalau bermasalah.
- **API key tersimpan plaintext** di tabel `Setting`.
- **Kegagalan `spendPoints` ditelan** (`generate/route.ts`) — call AI langka bisa gratis.
