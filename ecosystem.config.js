// Konfigurasi PM2 untuk menjalankan Nerona di VPS secara permanen.
// Jalankan: pm2 start ecosystem.config.js && pm2 save && pm2 startup
//
// Ganti `cwd` ke lokasi folder project di VPS Anda.
module.exports = {
  apps: [
    {
      name: "nerona",
      script: "npm",
      args: "start", // = next start (port 3000)
      cwd: "/var/www/nerona-web", // <-- SESUAIKAN dengan path di VPS
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
