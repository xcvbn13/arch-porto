#!/bin/sh
set -e

# APP_KEY wajib ada (dibuat sekali saat pertama start; disimpan di env compose)
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:" ]; then
  php artisan key:generate --force >/dev/null
fi

php artisan config:cache

# Migrasi + seeder idempoten (opsional, default aktif untuk kemudahan demo).
# Untuk produksi ketat: set APP_AUTO_MIGRATE=false dan jalankan migrasi manual.
if [ "$APP_AUTO_MIGRATE" = "true" ]; then
  php artisan migrate --force
  php artisan db:seed --force
fi

exec docker-php-entrypoint "$@"
