# Deploy Nerona ke VPS (Ubuntu) — USANG

> **Dokumen ini digantikan oleh `docs/production.md`. Jangan diikuti lagi.**
>
> Yang kurang di sini: cron `/api/billing/renewals` tidak disebut sama sekali (kalau
> hanya mengikuti panduan ini, **auto-renew paket bulanan tidak akan pernah jalan**),
> env var `POINTS_PER_USD` belum didaftar, dan langkah seed owner admin belum ada.

Panduan menjalankan Nerona Agent di VPS agar online 24 jam tanpa bergantung laptop.
File bantu yang dipakai: `ecosystem.config.js` (PM2), `Caddyfile` (HTTPS), `deploy.sh`.

## 0. Kenapa perlu langkah manual

Kode ini dirancang untuk Vercel. Di VPS ada dua perbedaan:

- **Background job (`waitUntil`)** — TETAP jalan di VPS karena proses Node hidup terus. Tidak
  perlu diubah.
- **Vercel Cron (`vercel.json`)** — TIDAK jalan di VPS. Ini jaring pengaman yang me-retry job
  tersangkut. Harus digantikan dengan **crontab sistem** (lihat langkah 6).

## 1. Prasyarat di VPS

```bash
# Node 18+ (contoh via nodesource)
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

## 2. Ambil kode & konfigurasi

```bash
sudo mkdir -p /var/www && cd /var/www
git clone <URL_REPO> nerona-web
cd nerona-web
```

Buat `.env.local` di server, isi semua variabel:

- `DATABASE_URL`, `DIRECT_URL` (Supabase)
- `NEXTAUTH_URL="https://domain-anda.com"`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `OWNER_ADMIN_EMAIL`, `RESEND_API_KEY`
- `SUMOPOD_API_KEY`, `SUMOPOD_BASE_URL`, `AGENT_MODEL`
- `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_APP_SECRET` /
  `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_DISPLAY_NUMBER`
- `CRON_SECRET`

> Di Google Cloud Console, tambahkan `https://domain-anda.com/api/auth/callback/google` sebagai
> authorized redirect URI.

## 3. Sesuaikan file bantu

- `ecosystem.config.js` → set `cwd` ke `/var/www/nerona-web`.
- `Caddyfile` → ganti `domain-anda.com` dengan domain Anda (A record sudah mengarah ke IP VPS).

## 4. Deploy pertama

```bash
bash deploy.sh
pm2 startup   # ikuti perintah yang ditampilkan agar PM2 auto-start saat reboot
```

## 5. Aktifkan HTTPS (Caddy)

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Cek `https://domain-anda.com` sudah bisa dibuka dengan gembok hijau.

## 6. Crontab pengganti Vercel Cron (WAJIB)

```bash
crontab -e
```

Tambahkan (ganti CRON_SECRET & domain):

```
*/5 * * * * curl -s -H "Authorization: Bearer ISI_CRON_SECRET_ANDA" https://domain-anda.com/api/agent/cron > /dev/null
```

## 7. Daftarkan webhook di Meta

- Callback URL: `https://domain-anda.com/api/whatsapp/webhook`
- Verify token: sama dengan `WHATSAPP_VERIFY_TOKEN`
- Subscribe field: `messages`

## Update berikutnya

Cukup jalankan lagi:

```bash
bash deploy.sh
```

## Perintah berguna

```bash
pm2 logs nerona        # lihat log
pm2 restart nerona     # restart manual
pm2 monit              # monitor CPU/RAM
sudo journalctl -u caddy -f   # log Caddy/HTTPS
```
