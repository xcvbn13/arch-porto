# visitor@imam-portfolio — Portfolio Terminal Arch (Real Shell)

Website portfolio **Fullstack Developer** yang antarmukanya adalah **bash Arch
Linux sungguhan** di browser: pengunjung langsung mendarat di shell nyata
(read-only, PATH terkurasi) dan menjelajahi profil, keahlian, proyek,
pengalaman, pendidikan, publikasi, dan kontak dengan mengetik perintah.

> ⚠️ **Kejujuran desain:** xterm.js hanya emulator tampilan — yang berjalan di
> baliknya adalah bash sungguhan di container Arch non-root, read-only, tanpa
> jaringan. "Read-only" ditegakkan dengan PATH allowlist + rootfs read-only,
> bukan boundary matematis (lihat Threat model). Bukan produk resmi Arch Linux.

## Arsitektur

```mermaid
flowchart LR
    B[xterm.js<br/>emulator murni]
    N[Nginx edge<br/>static + /api proxy + /pty WebSocket]
    P[PTY bridge Node<br/>node-pty → bash visitor<br/>PATH=/opt/bin terkurasi]
    L[Laravel 12 API<br/>/api/v1 · validasi · rate limit]
    D[(PostgreSQL 17)]
    A[/admin SPA<br/>panel kelola data]

    B -->|WS /pty + tiket| N --> P
    P -->|command portfolio via urllib| L --> D
    B -->|/api| N --> L
    A --> N
```

- **Shell utama**: PTY bridge (`pty/`) menjalankan `bash` sebagai user
  `visitor`; PATH hanya berisi binary read-only + dispatcher portfolio.
  Tiket sesi dari Laravel (rate limit, cap sesi, TTL idle, batas output).
- **Command portfolio** (`about`, `skills`, `projects [show <id>]`,
  `experience`, `education`, `certifications`, `publications`,
  `contact [send …]`, `github`, `resume`, `socials`, `help`) = symlink ke satu
  dispatcher Python yang memanggil REST API (URL tetap di kode; argumen
  divalidasi backend).
- **Panel admin**: command tersembunyi **`config-admin`** (tidak muncul di
  `help`) → password tersamar → mencetak tautan sekali pakai → browser login
  sesi → `/admin`.

## Command di Shell

```
help                          daftar command (config-admin disembunyikan)
about · skills · projects · experience · education · certifications
publications · contact · github · resume · socials
ls · cat · pwd · whoami · uname · fastfetch · pacman -Q · grep · head · wc
echo · date · sort · tr · clear
config-admin                  (tersembunyi) panel admin
exit                          keluar sesi
```

Tidak tersedia (di luar allowlist): `sh`, `python`, `curl`, `dd`, `chmod`,
`sudo` — `command not found`. Write gagal di OS (rootfs read-only; hanya
`/tmp` tmpfs 16 MiB noexec).

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18, TypeScript, Vite, xterm.js (+@xterm/addon-fit), Tailwind CSS 4 |
| Testing FE | Vitest + React Testing Library |
| Backend | Laravel 12, PHP 8.4 (FrankenPHP), PostgreSQL 17 |
| Testing BE | PHPUnit (sqlite in-memory) |
| Infra | Docker Compose, Nginx (edge reverse proxy), Arch Linux (sandbox opsional) |

## Struktur Repository

```
porto-arch-base/
├── frontend/                  # xterm.js murni (emulator) + panel /admin
│   ├── src/components/Terminal.tsx    # attach WebSocket /pty + reconnect
│   ├── src/admin/AdminApp.tsx         # panel kelola data (CRUD + upload)
│   ├── src/terminal/api.ts            # REST client (timeout, sanitasi)
│   └── nginx/                         # edge: static + /api + /pty WS + /admin/enter
├── backend/                   # Laravel 12 API (/api/v1) + web /admin/enter
│   ├── app/Http/Controllers/Api/      # portfolio + admin CRUD + pty sessions
│   ├── app/Http/Controllers/Api/Admin/ # login/lockout/enter-token + CRUD
│   ├── database/seeders/data/         # portfolio.php + admins.php (satu sumber)
│   └── tests/Feature/                 # 69 test
├── pty/                       # shell Arch nyata (service utama)
│   ├── server.js                      # bridge node-pty: tiket→bash visitor
│   ├── portfolio-cli.py               # dispatcher command portfolio (+config-admin)
│   ├── Dockerfile                     # PATH /opt/bin terkurasi, .bashrc read-only
│   └── tests/security_tests.sh        # 22 cek keamanan + hardening
├── docker-compose.yml
└── .env.example
```

## Instalasi Lokal

Prasyarat: **Docker** + **Docker Compose v2** (Node/PHP lokal TIDAK diperlukan).

```bash
cp .env.example .env
# WAJIB: ganti DB_PASSWORD dan SANDBOX_TOKEN di .env
#   openssl rand -hex 32   → untuk SANDBOX_TOKEN

docker compose up -d --build
```

Aplikasi tersedia di **http://localhost:8080**. Saat start pertama, backend
otomatis menjalankan `migrate` + `db:seed` (idempoten; nonaktifkan dengan
`APP_AUTO_MIGRATE=false`).

### Menjalankan tanpa Docker (development)

**Frontend** (butuh Node 20+):

```bash
cd frontend && npm install && npm run dev
# Vite proxy /api → http://backend:80 (ubah via VITE_API_PROXY)
```

**Backend** (butuh PHP 8.4 + PostgreSQL):

```bash
cd backend && composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### Menjalankan Test

```bash
# Frontend (67 test: parser, registry, handler, escaping, API error)
docker run --rm -v "$PWD/frontend":/app -w /app -u "$(id -u):$(id -g)" \
  -e HOME=/tmp node:22-alpine sh -c "npm ci && npm test"

# Backend (33 test: endpoint, validasi, rate limit, sandbox, kebocoran)
docker run --rm -v "$PWD/backend":/app -w /app -u "$(id -u):$(id -g)" \
  -e HOME=/tmp dunglas/frankenphp:php8.4 php vendor/bin/phpunit

# Sandbox (selftest + uji keamanan + cgroup) — lihat bagian Sandbox
```

### Menjalankan Docker Compose

```bash
docker compose up -d --build       # frontend + backend + database
docker compose ps                  # status + health
docker compose logs -f backend     # log API
docker compose down                # stop (data DB tetap di volume pgdata)
```

## Referensi Environment Variables

| Variabel | Default | Keterangan |
|---|---|---|
| `APP_HTTP_PORT` | `8080` | Port publik frontend (Nginx) |
| `APP_URL` | `http://localhost:8080` | URL kanonik aplikasi |
| `APP_AUTO_MIGRATE` | `true` | migrate+seed otomatis saat start (idempoten) |
| `DB_DATABASE` | `portfolio` | Nama database |
| `DB_USERNAME` | `portfolio` | User database |
| `DB_PASSWORD` | — **(wajib)** | Password database |
| `TRUSTED_PROXIES` | rentang privat Docker | CIDR proxy yang dipercaya |
| `ARCH_SANDBOX_ENABLED` | `false` | Aktifkan mode nyata (lihat Sandbox) |
| `SANDBOX_URL` | `http://sandbox:8080` | Alamat internal service sandbox |
| `SANDBOX_TOKEN` | — | Token bersama Laravel↔sandbox |
| `SANDBOX_EXEC_TIMEOUT` | `5` | Timeout eksekusi per command (detik) |
| `SANDBOX_OUTPUT_LIMIT` | `65536` | Batas output per command (byte) |
| `SANDBOX_MAX_CONCURRENT` | `4` | Batas eksekusi paralel di sandbox (lebih → 429 busy) |
| `SANDBOX_SESSION_TTL` | `600` | Masa berlaku sesi pengunjung (detik) |
| `SANDBOX_MAX_SESSIONS` | `50` | Batas sesi aktif bersamaan |
| `ADMIN_EMAIL` | `root@imam-portfolio.local` (via seeder) | Akun pertama daftar root (login `sudo su`) |
| `ROOT_PASSWORD` | — **(wajib ganti)** | Password akun root (hash saat seed) |
| `ADMIN_PASSWORD` | — **(wajib ganti)** | Password akun admin kedua (hash saat seed) |

## Setup Database, Migrasi, Seeder

- Migrasi & seeder dijalankan otomatis saat start (lihat `APP_AUTO_MIGRATE`).
- Manual: `docker compose exec backend php artisan migrate --force` lalu
  `docker compose exec backend php artisan db:seed --force` (idempoten).
- **Satu sumber data portfolio:** `backend/database/seeders/data/portfolio.php`
  — profile, skills, projects, experience, education, certifications,
  publications. Semua nilai adalah **placeholder jelas**; array kosong
  sengaja kosong (tidak ada riwayat/URL/metrik yang dikarang).
- Pesan kontak masuk disimpan di tabel `contact_messages` (tidak pernah di-seed).

## Cara Menambah Proyek Portfolio

1. Edit `backend/database/seeders/data/portfolio.php` → tambahkan entry di
   array `projects` (title, summary, description, problem, contribution,
   architecture, stack, repo_url, demo_url, metrics, year).
2. Jalankan: `docker compose exec backend php artisan db:seed --force`
3. Verifikasi di terminal: `projects list` lalu `projects show <id>`.

Hanya tambahkan proyek yang benar-benar milik Anda; `metrics` boleh `null`.

## Cara Menambah / Mengubah Command Terminal

Command portfolio hidup di **satu dispatcher**: `pty/portfolio-cli.py`
(symlink `/opt/bin/<nama>`). Menambah command:

1. Tambah handler di `pty/portfolio-cli.py` (subcommand = basename argv[0];
   endpoint REST tetap di kode — argumen pengunjung divalidasi backend).
2. Tambah symlink di `pty/Dockerfile` (`ln -sf /opt/portfolio-cli.py /opt/bin/<nama>`).
3. (Opsional) daftarkan di `help` — kecuali command rahasia seperti `config-admin`.
4. Test: tambah cek di `pty/tests/security_tests.sh`.

Command read-only murni cukup ditambahkan ke daftar PATH terkurasi di
`pty/Dockerfile`. Apa pun di luar PATH + dispatcher = `command not found`.

## Panel Admin (`config-admin` → `/admin`)

Pemilik dapat mengelola seluruh data portfolio (profile, skills, projects,
experience, education, certifications, publications), membaca/menghapus pesan
kontak, dan mengganti password melalui **panel admin web**.

Cara pakai:

1. Di shell Arch, jalankan command tersembunyi:
   ```
   config-admin
   [sudo] password for visitor: ********
   ```
   Password diketik **tanpa echo** (getpass). Login sebagai akun root seeder.
2. Sukses → shell mencetak **tautan sekali pakai** (OSC 8, bisa diklik)
   `/admin/enter?token=…` — buka di browser.
3. Browser login sesi admin → redirect ke **`/admin`**. Kelola data lewat
   sidebar; klik **logout** untuk mengakhiri sesi.

Akun root dikelola lewat **`backend/database/seeders/data/admins.php`** — daftar
akun (name, email, password) yang dibuat seeder saat dijalankan (idempoten:
email yang sudah ada tidak ditimpa, jadi password yang diganti lewat panel
tetap bertahan saat restart). Password bisa di-override lewat env
`ROOT_PASSWORD` / `ADMIN_PASSWORD`.

Keamanan:

- Akun admin awal dibuat seeder dari env `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  (placeholder — **wajib ganti** sebelum deployment). Password yang diganti
  lewat panel tidak ditimpa seeder saat container restart.
- Rate limit login 10/menit/IP + **lockout 15 menit** setelah 5 kegagalan.
- Semua endpoint admin (`/api/v1/admin/*`) menolak tanpa sesi (401); user
  non-admin ditolak (403). Cookie sesi httpOnly + SameSite=Lax; aktifkan
  `SESSION_SECURE_COOKIE=true` (HTTPS) di produksi.
- Setiap login, perubahan data, dan ganti password tercatat di
  `storage/logs/admin.log` (tanpa isi password).
- Pengunjung tetap read-only: tanpa password yang benar, tidak ada jalur
  tulis yang terbuka.

## Gambar di Dalam Terminal (sixel/iTerm2)

xterm.js memuat addon resmi `@xterm/addon-image` (sixel + iTerm2 inline
image). Yang dipakai aplikasi:

- **Banner pembuka** — logo fetch (upload via panel admin) dirender bridge
  sebagai satu IIP image + baris info dari `GET /api/v1/fetch`.

**Avatar = upload file** (bukan URL): di panel admin (`sudo su` → Profile)
pilih file PNG/JPG/WebP/GIF (maks 2 MB) → disimpan di volume persisten
`avatar-storage` dan disajikan lewat `GET /api/v1/files/avatars/{file}`
(baca publik, nama file divalidasi regex + realpath; upload/hapus hanya
untuk admin). Screenshot proyek masih berupa URL eksternal — pastikan
**same-origin** atau host yang mengizinkan **CORS**. Jika fetch gagal,
terminal menampilkan `[gambar gagal dimuat]` dan tetap berfungsi normal.

Catatan keamanan: gambar hanya berasal dari data yang dikelola pemilik
(bukan upload pengunjung); piksel di-decode browser (tanpa injeksi HTML);
aliran sixel/escape mentah dari sandbox tetap disanitasi — render memakai
jalur API addon, bukan parser protokol dari output tak tepercaya.

## Config Fetch Info (banner / fastfetch / neofetch)

Blok informasi terminal (banner awal, `fastfetch`, `neofetch`) dikelola dari
**database** lewat panel admin (`sudo su` → **Fetch Info**):

- **Baris komponen** (sisi kanan) — tabel `fetch_entries`: tambah/edit/hapus
  label & value; baris baru otomatis di urutan terakhir.
- **Logo** (sisi kiri) — upload gambar (PNG/JPG/WebP/GIF ≤ 2 MB) menggantikan
  ASCII art; hapus logo → kembali ke ASCII default.

Terminal mengambil `GET /api/v1/fetch`; jika API tidak terjangkau, **fallback
ke config lokal** `frontend/src/config/portfolio.ts` (`fetchInfo`) sehingga
banner tetap tampil offline. Baris default di-seed hanya saat tabel kosong —
perubahan dari panel tidak ditimpa restart.

## Shell Arch Nyata (PTY) — Antarmuka Utama

Halaman utama LANGSUNG terhubung ke bash Arch (bukan simulasi):

```bash
# .env — wajib aktif agar terminal utama berfungsi
ARCH_PTY_ENABLED=true
docker compose --profile sandbox up -d --build pty
```

Cara kerja: xterm.js ↔ WebSocket `/pty` (Nginx upgrade + rate limit 2r/s) ↔
bridge Node (`pty/`, node-pty) di container Arch → `bash --noprofile` sebagai
user non-root `visitor`, PATH=/opt/bin. Banner pembuka (logo + baris info)
diambil bridge dari `GET /api/v1/fetch`. Putus koneksi → reconnect otomatis
(tiket baru).

**Batasan read-only (jujur):**

- PATH hanya berisi binary kurasi + dispatcher portfolio. Tidak ada `sh`,
  `python`, `curl`, `dd`, `chmod`, `sudo` — di luar daftar =
  `command not found`.
- **Image runtime TANPA interpreter/kompiler** (multi-stage build): python,
  gcc, make, perl TIDAK ada di image — absolute path pun tidak bisa
  menjalankan apa pun. `node` hanya untuk bridge, `chmod 750` root —
  visitor tidak bisa mengeksekusinya. `command -p` (default PATH bash)
  pun tidak menemukan apa-apa di luar binary read-only.
- Rootfs read-only (write ditolak OS; satu-satunya area tulis = tmpfs `/tmp`
  16 MiB noexec, hilang saat restart).
- Bridge berjalan sebagai **root terkurung** (cap_drop ALL + cap_add
  SETUID/SETGID) semata-mata untuk menurunkan setiap proses PTY ke
  uid/gid 1000 (visitor).
- **Tanpa akses internet** (jaringan internal saja; diuji via
  `/proc/net/route` tanpa default gateway), tanpa docker socket, tanpa mount host.
- Tiket sesi dari Laravel: rate limit 5/menit/IP, maks 20 sesi global,
  TTL 10 menit idle → PTY di-kill, batas output 512 KiB/sesi, flood → tutup.

**Keterbatasan keamanan yang harus dipahami:** ini shell bash sungguhan untuk
pengunjung anonim — risiko tertinggi di proyek ini. PATH+read-only adalah
kurasi yang baik tapi **bukan boundary matematis**; teknik escape bash yang
canggih tetap mungkin, dan exploit kernel container bisa keluar. Untuk
produksi publik, jalankan di belakang gVisor/Firecracker atau pertimbangkan
ulang eksposurnya. Uji keamanan: `pty/tests/security_tests.sh` (22 cek).

## Threat Model dan Keterbatasan Sandbox

**Aset:** konten portfolio (publik), pesan kontak pengunjung, host yang
menjalankan container.

**Ancaman yang dimitigasi:**

| Ancaman | Mitigasi |
|---|---|
| Eksekusi command arbitrer | PATH allowlist (`/opt/bin`) + rootfs read-only; tanpa `sh`/`python`/`curl` |
| Shell escape/abuse bash | user non-root, tanpa capabilities, tanpa jaringan, pids/cpu/mem limit |
| Path traversal / baca file sistem | Rootfs read-only berisi sistem Arch publik saja; tanpa mount host/secrets |
| Akses file sensitif host | Tanpa mount host, tanpa socket Docker, tanpa devices |
| Bash diketahui publik (termasuk trik escape) | Diakui: kurasi bukan boundary matematis — lihat keterbatasan PTY |
| Kebocoran environment/credential | Env minimal untuk subprocess; respons 500 generik; `APP_DEBUG=false` |
| Open proxy / eksfiltrasi | Sandbox tanpa network; API rate-limited; hanya GET publik + contact |
| DoS sandbox | mem/cpu/pids limit, batas output, timeout, sesi cap, rate limit |
| Kebocoran pesan kontak | Log tanpa isi pesan; tidak dikirim email; validasi + rate limit |
| XSS via output terminal | Output selalu teks ke xterm; string API disanitasi ANSI/control chars |

**Keterbatasan yang jujur:**

- **Docker bukan isolasi sempurna.** Kernel host dipakai bersama; exploit
  kernel bisa keluar container. Untuk eksposur publik yang lebih aman,
  pertimbangkan gVisor/Firecracker/QEMU microVM, atau jangan aktifkan
  sandbox sama sekali (default).
- Rootfs read-only **bukan** pembatasan eksekusi; keamanan eksekusi berasal
  dari allowlist command, bukan dari read-only saja.
- Limit memori 128 MiB adalah **nilai awal** — hasil pengukuran aktual ada di
  bagian berikutnya; sesuaikan `mem_limit` berdasarkan pengukuran.
- Sandbox dirancang untuk perintah demonstrasi read-only, **bukan** shell
  jarak jauh untuk pengunjung anonim.
- Pengujian yang dilakukan tercantum di `sandbox/tests/`; sandbox dinyatakan
  siap produksi hanya jika semua uji lolos di lingkungan deployment Anda.

## Konfigurasi Resource PTY

Limit container pty (`docker-compose.yml`): mem 256 MiB, CPU 0.5 core,
PID 128, output 512 KiB/sesi, maks 20 sesi. Ukur saat beban nyata:
`docker stats portfolio-pty` sambil membuka beberapa sesi; sesuaikan
`mem_limit`/`PTY_MAX_SESSIONS` bila perlu. Memori browser (xterm) terpisah
dari memori container — keduanya tidak sama.

## Deployment Produksi (Nginx)

1. `cp .env.example .env`, isi semua nilai (password/token acak), set
   `APP_DEBUG=false` (sudah default), `APP_AUTO_MIGRATE` sesuai kebutuhan.
2. Bangun & naikkan: `docker compose up -d --build`.
3. **HTTPS**: sertifikat (Let's Encrypt/certbot) di host, lalu salin
   `frontend/nginx/conf.d/ssl.example.conf` menjadi `default.conf` setelah
   mengganti `$DOMAIN` dan mengarahkan path sertifikat (atau pakai
   reverse proxy + certbot eksternal). Jangan hardcode domain/sertifikat di repo.
4. Hanya port frontend (80/443) yang dibuka; `backend`, `database`, `sandbox`
   tidak pernah dipublish.
5. Verifikasi header keamanan (CSP, X-Content-Type-Options, X-Frame-Options).

### Checklist Deployment

- [ ] `.env` diisi; tidak ada secret di repo (`git status`)
- [ ] `docker compose up -d --build` sukses; semua service `healthy`
- [ ] `curl http://localhost:8080/api/v1/profile` mengembalikan JSON
- [ ] `curl http://localhost:8080/up` → ok (backend via proxy)
- [ ] HTTPS aktif (jika produksi); HTTP redirect 301
- [ ] `sandbox/tests/security_tests.sh` lolos (hanya jika sandbox diaktifkan)
- [ ] Rate limit contact teruji (3/menit/IP)
- [ ] Log rotation aktif (bawaan compose: 10 MB × 3 file)

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `about` → "Cannot reach portfolio API" | Backend belum sehat | `docker compose ps`; tunggu healthcheck; `docker compose logs backend` |
| Welcome tampil tapi `projects` error 500 | DB belum di-migrate | `docker compose exec backend php artisan migrate --force` |
| `DB_PASSWORD belum diatur` saat up | `.env` belum dibuat | `cp .env.example .env` lalu isi |
| `sandbox` → DISABLED | Default memang nonaktif | Set `ARCH_SANDBOX_ENABLED=true` + profile sandbox |
| `sandbox_unavailable` | Token beda / sandbox mati | Samakan `SANDBOX_TOKEN` di `.env`; `docker compose --profile sandbox ps` |
| Terminal penuh sesak di mobile | Viewport/keyboard | Gunakan input bar bawah (tampil otomatis di layar sentuh) |
| Build backend lama | Kompilasi pdo_pgsql | Normal sekali; berikutnya pakai cache layer |

## Backup dan Recovery

- Satu-satunya data persisten: volume `pgdata` (PostgreSQL).
  Backup: `docker compose exec database pg_dump -U portfolio portfolio > backup.sql`
  Restore: `docker compose exec -T database psql -U portfolio portfolio < backup.sql`
- Pesan kontak ikut ter-backup bersama dump database.
- Konfigurasi (seeder) tersimpan di git — bukan state runtime.

## Lisensi

Proyek ini adalah portfolio pribadi. Bukan produk resmi Arch Linux dan tidak
berafiliasi dengan Arch Linux.
