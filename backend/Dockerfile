# Backend Laravel — FrankenPHP (PHP 8.4), non-root, port internal 8080.
FROM dunglas/frankenphp:php8.4

# pdo_pgsql untuk PostgreSQL + zip (dibutuhkan composer) — dikompilasi saat build saja
RUN install-php-extensions pdo_pgsql opcache zip

WORKDIR /app

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1

# Dependency produksi — tanpa dev
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader

COPY . .

# Manifest package bisa basi dari build host (dev deps) — buang, dibuat ulang
# oleh entrypoint (config:cache / package:discover).
RUN rm -rf bootstrap/cache/*.php database/database.sqlite

# Skeleton .env dengan baris APP_KEY= agar `php artisan key:generate` bisa
# menulis saat start pertama; nilai aktual masuk lewat environment compose.
RUN printf 'APP_KEY=\n' > .env && chown www-data:www-data .env

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
    storage/app/avatars \
    bootstrap/cache storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/Caddyfile /etc/caddy/Caddyfile
# Batas upload PHP (default 2M terlalu kecil untuk file portfolio 5MB)
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/99-uploads.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER www-data
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
