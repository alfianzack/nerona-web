#!/usr/bin/env bash
# Skrip deploy Nerona di VPS. Jalankan dari dalam folder project:
#   bash deploy.sh
# Syarat: file .env.local sudah terisi lengkap di VPS.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Menarik kode terbaru"
git pull

echo "==> Install dependency"
npm install

echo "==> Migrasi database (prisma migrate deploy via .env.local)"
npm run db:migrate

echo "==> Build produksi"
npm run build

echo "==> Restart lewat PM2"
if pm2 describe nerona > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "==> Deploy selesai. Cek: pm2 logs nerona"
