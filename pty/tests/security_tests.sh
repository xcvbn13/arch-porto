#!/usr/bin/env bash
# ============================================================================
# Uji keamanan PTY shell (bash read-only, PATH terkurasi).
# Jalankan dari root repo setelah: docker compose --profile sandbox up -d pty
# ============================================================================
set -u
cd "$(dirname "$0")/../.."

if [ -f .env ]; then set -a; . ./.env; set +a; fi

SVC="pty"
C="portfolio-pty"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ok  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

echo "== 1. Handshake: tiket wajib =="
# Tanpa tiket → bridge menutup koneksi (WS gagal)
OUT=$(docker compose --profile sandbox exec -T -w /opt/pty-server "$SVC" node -e "
const WebSocket = require('/opt/pty-server/node_modules/ws');
const ws = new WebSocket('ws://127.0.0.1:3000/pty');
ws.on('open', () => { console.log('OPEN-WITHOUT-TICKET'); process.exit(1); });
ws.on('error', () => { console.log('REJECTED'); process.exit(0); });
ws.on('close', () => { console.log('REJECTED'); process.exit(0); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 3000);
" 2>&1)
echo "$OUT" | grep -q "REJECTED" && ok "tanpa tiket ditolak" || bad "tanpa tiket ditolak — got: $OUT"

echo "== 2. Tiket tidak valid ditolak =="
OUT=$(docker compose --profile sandbox exec -T -w /opt/pty-server "$SVC" node -e "
const WebSocket = require('/opt/pty-server/node_modules/ws');
const ws = new WebSocket('ws://127.0.0.1:3000/pty?ticket=deadbeef');
ws.on('open', () => { console.log('OPEN-INVALID'); process.exit(1); });
ws.on('error', () => { console.log('REJECTED'); process.exit(0); });
ws.on('close', () => { console.log('REJECTED'); process.exit(0); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 3000);
" 2>&1)
echo "$OUT" | grep -q "REJECTED" && ok "tiket invalid ditolak" || bad "tiket invalid ditolak — got: $OUT"

echo "== 3. Sesi sah: command read-only jalan =="
TICKET=$(curl -s -X POST http://localhost:8080/api/v1/pty/sessions | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['ticket'] if 'data' in d else 'ERR:'+d.get('message','?'))" 2>/dev/null)
if [[ "$TICKET" == ERR:* ]]; then
  bad "gagal membuat tiket: ${TICKET#ERR:} (tunggu TTL / php artisan cache:clear)"
else
  # ID proyek untuk `projects show` — pilih yang memiliki description
  # (agar label Description teruji); fallback proyek pertama.
  SHOW_ID=$(curl -s http://localhost:8080/api/v1/projects | python3 -c "
import json,sys
rows=json.load(sys.stdin).get('data',[])
ids=[r['id'] for r in rows if r.get('description')]
print(ids[0] if ids else (rows[0]['id'] if rows else ''))
" 2>/dev/null)
  RESULT=$(docker compose --profile sandbox exec -T -w /opt/pty-server "$SVC" node -e "
const WebSocket = require('/opt/pty-server/node_modules/ws');
const ws = new WebSocket('ws://127.0.0.1:3000/pty?ticket=$TICKET');
let out = '';
ws.on('open', () => ws.send('echo PTY_OK; echo x > /home/visitor/f; whoami; command -v sh || echo NO_SH; command -v python || echo NO_PYTHON; command -v curl || echo NO_CURL; /usr/bin/python --version 2>&1 || echo NO_ABS_PYTHON; /usr/bin/node -v 2>&1 || echo NO_ABS_NODE; command -p python --version 2>&1 || echo NO_CMDP_PYTHON; command -p sh -c echo CMDPSH 2>&1 || echo NO_CMDP_SH; help; about; show all; projects; projects show ${SHOW_ID}; resume 2>&1 || echo NO_RESUME; clear; exit\r'));
ws.on('message', d => { out += d.toString(); });
ws.on('close', () => { console.log(out); process.exit(0); });
setTimeout(() => process.exit(1), 12000);
" 2>&1)
  echo "$RESULT" | grep -q "PTY_OK" && ok "bash PTY merespons" || bad "bash PTY merespons — got: $(echo "$RESULT" | head -3)"
  echo "$RESULT" | grep -q "NO_SH" && ok "sh tidak tersedia (PATH terkurasi)" || bad "sh tidak tersedia"
  echo "$RESULT" | grep -q "NO_PYTHON" && ok "python tidak tersedia" || bad "python tidak tersedia"
  echo "$RESULT" | grep -q "NO_CURL" && ok "curl tidak tersedia (tanpa jaringan)" || bad "curl tidak tersedia"
  echo "$RESULT" | grep -q "NO_ABS_PYTHON" && ok "python via absolute path ditolak (tidak ada di image)" || bad "python via absolute path"
  echo "$RESULT" | grep -q "NO_ABS_NODE" && ok "node via absolute path ditolak (750 root)" || bad "node via absolute path"
  echo "$RESULT" | grep -q "NO_CMDP_PYTHON" && ok "command -p python gagal" || bad "command -p python"
  echo "$RESULT" | grep -q "NO_CMDP_SH" && ok "command -p sh gagal (sh tidak ada)" || bad "command -p sh"
  echo "$RESULT" | grep -q "visitor" && ok "user non-root (visitor)" || bad "user visitor"
  if echo "$RESULT" | grep -q "Read-only file system"; then
    ok "write ke /home/visitor ditolak OS"
  else
    bad "write ke /home/visitor TIDAK ditolak — got: $(echo "$RESULT" | grep -i 'cannot\|denied\|read-only' | head -1)"
  fi
  echo "$RESULT" | grep -q "Available commands" && ok "help = daftar command kurasi" || bad "help = daftar command kurasi"
  if echo "$RESULT" | grep -q "config-admin"; then bad "config-admin TERSEMBUNYI dari help"; else ok "config-admin tersembunyi dari help"; fi
  echo "$RESULT" | grep -q "Fullstack Developer" && ok "command 'about' menjangkau API backend" || bad "command 'about' menjangkau API backend"
  RESULT_CLEAN=$(printf '%s' "$RESULT" | tr -d '\r' | sed $'s/\x1b\[[0-9;]*m//g')
  echo "$RESULT_CLEAN" | grep -q "backend:" && ok "command 'skills' menampilkan data nyata" || bad "command 'skills' menampilkan data nyata"
  echo "$RESULT_CLEAN" | grep -q "Detail: projects show" && ok "command 'projects' menampilkan data nyata" || bad "command 'projects' menampilkan data nyata"
  if [ -n "$SHOW_ID" ]; then
    echo "$RESULT_CLEAN" | grep -q " ABOUT " && ok "show all: bagian ABOUT paling atas" || bad "show all: bagian ABOUT paling atas"
  echo "$RESULT_CLEAN" | grep -q " SKILLS " && ok "show all: menampilkan bagian SKILLS" || bad "show all: menampilkan bagian SKILLS"
  echo "$RESULT_CLEAN" | grep -q " SOCIALS " && ok "show all: menampilkan bagian SOCIALS" || bad "show all: menampilkan bagian SOCIALS"
  # Urutan: ABOUT < EXPERIENCE < EDUCATION < SKILLS < PUBLICATIONS < CERTIFICATIONS < PROJECTS < SOCIALS
  ORDER_OK=1
  POS=0
  for sec in ABOUT EXPERIENCE EDUCATION SKILLS PUBLICATIONS CERTIFICATIONS PROJECTS SOCIALS; do
    P=$(echo "$RESULT_CLEAN" | grep -n " $sec " | head -1 | cut -d: -f1)
    if [ -z "$P" ] || [ "$P" -le "$POS" ]; then ORDER_OK=0; break; fi
    POS=$P
  done
  if [ "$ORDER_OK" = "1" ]; then ok "show all: urutan bagian sesuai"; else bad "show all: urutan bagian sesuai"; fi
  HELP_SEC=$(echo "$RESULT_CLEAN" | sed -n '/Available commands/,/arch (binary asli)/p')
  SI=$(echo "$HELP_SEC" | grep -n "show all" | head -1 | cut -d: -f1)
  AI=$(echo "$HELP_SEC" | grep -n "about " | head -1 | cut -d: -f1)
  if [ -n "$SI" ] && [ -n "$AI" ] && [ "$SI" -lt "$AI" ]; then ok "help: show all di urutan pertama (sebelum about)"; else bad "help: show all di urutan pertama"; fi
  echo "$RESULT_CLEAN" | grep -q "Project Affiliation" && ok "projects show: label Project Affiliation" || bad "projects show: label Project Affiliation"
  if echo "$RESULT" | grep -q ']8;;https://'; then ok "link output dibungkus OSC 8 (clickable)"; else bad "link output dibungkus OSC 8 (clickable)"; fi
    echo "$RESULT_CLEAN" | grep -q "Description" && ok "projects show: menampilkan Description" || bad "projects show: menampilkan Description"
  else
    ok "projects show: (tidak ada proyek — dilewati)"
  fi
  if echo "$RESULT" | grep -q "MISSING"; then bad "output tidak boleh mengandung %!s(MISSING)"; else ok "tidak ada %!s(MISSING) di output"; fi
  if echo "$RESULT" | grep -q "Belum ada data"; then bad "tidak boleh ada 'Belum ada data' padahal data ada"; else ok "tidak ada pesan 'Belum ada data' palsu"; fi
  echo "$RESULT" | grep -q "resume: command not found" && ok "command 'resume' sudah dihapus" || bad "command 'resume' sudah dihapus"
  echo "$RESULT" | grep -q "Portfolio=welcome" && ok "clear mengirim penanda welcome (dirender frontend)" || bad "clear mengirim penanda welcome"
  # Tanpa default route internet: kolom Destination (field ke-2) tidak boleh 00000000
  ROUTES=$(docker compose --profile sandbox exec -T "$SVC" cat /proc/net/route 2>/dev/null | awk 'NR>1 {print $2}')
  if echo "$ROUTES" | grep -q "00000000"; then
    bad "ADA default route (internet) di pty!"
  else
    ok "tanpa default route internet"
  fi
fi

echo "== 4. Hardening container =="
chk() { docker inspect -f "{{.HostConfig.$1}}" "$C" 2>/dev/null | grep -qE "$2" && ok "$3" || bad "$3"; }
chk ReadonlyRootfs "^true$" "read_only rootfs"
chk PidsLimit "^128$" "pids_limit 128"
chk Memory "^268435456$" "mem_limit 256m"
chk NanoCpus "^500000000$" "cpu 0.5"
chk Privileged "^false$" "tanpa privileged"
docker inspect -f '{{.HostConfig.SecurityOpt}}' "$C" | grep -q "no-new-privileges" && ok "no-new-privileges" || bad "no-new-privileges"
docker inspect -f '{{.HostConfig.CapDrop}}' "$C" | grep -q "ALL" && ok "cap_drop ALL" || bad "cap_drop ALL"
docker inspect -f '{{.HostConfig.CapAdd}}' "$C" | grep -q "SETUID" && ok "hanya SETUID/SETGID (bridge menurunkan ke visitor)" || bad "hanya SETUID/SETGID"
docker exec "$C" sh -c 'ls /var/run/docker.sock 2>&1' | grep -q "No such file" && ok "tanpa docker.sock" || bad "tanpa docker.sock"
if docker inspect -f '{{json .HostConfig.PortBindings}}' "$C" | grep -q '3000'; then bad "port bridge terpublish!"; else ok "tanpa port publish (hanya via nginx)"; fi

echo ""
echo "Hasil: $PASS ok, $FAIL gagal"
[ "$FAIL" -eq 0 ]
