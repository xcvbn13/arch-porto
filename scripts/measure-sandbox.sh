#!/usr/bin/env bash
# ============================================================================
# Pengukuran resource sandbox (spec §12): idle, satu command, berulang,
# konkuren, dan timeout. Jalankan dari root repo saat sandbox aktif.
# Output: peak memori/cpu per skenario (docker stats).
# ============================================================================
set -u
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
S="portfolio-sandbox"   # container (docker stats)
SVC="sandbox"          # service (compose exec)

measure() { # measure "<label>" — 8 detik sampling
  local label="$1" max_mem="0" max_cpu="0" line v c
  for _ in $(seq 1 8); do
    line=$(docker stats --no-stream --format '{{.MemUsage}}|{{.CPUPerc}}' "$S" 2>/dev/null || echo "0 / 0|0%")
    v=$(echo "$line" | cut -d'|' -f1 | awk '{print $1}')
    case "$v" in *MiB) v=${v%MiB};; *KiB) v=$(awk "BEGIN{printf \"%.2f\", ${v%KiB}/1024}");; *GiB) v=$(awk "BEGIN{printf \"%.2f\", ${v%GiB}*1024}");; *) v=0;; esac
    [ "$(awk "BEGIN{print ($v>$max_mem)}")" = "1" ] && max_mem="$v"
    c=$(echo "$line" | cut -d'|' -f2 | tr -d '%')
    [ "$(awk "BEGIN{print ($c>$max_cpu)}")" = "1" ] && max_cpu="$c"
    sleep 1
  done
  printf "%-28s peak mem: %6.2f MiB | peak cpu: %4s%%\n" "$label" "$max_mem" "$max_cpu"
}

echo "== Idle =="
measure "idle"

echo "== Satu command (fastfetch) =="
docker compose --profile sandbox exec -T "$SVC" python -c "
import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8080/exec', data=json.dumps({'command':'fastfetch','args':[]}).encode(), method='POST')
req.add_header('X-Sandbox-Token', '${SANDBOX_TOKEN:-}')
urllib.request.urlopen(req, timeout=8).read()
" >/dev/null 2>&1
measure "setelah 1x fastfetch"

echo "== Command berulang (30x pacman -Q) =="
for _ in $(seq 1 30); do
  docker compose --profile sandbox exec -T "$SVC" python -c "
import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8080/exec', data=json.dumps({'command':'pacman','args':['-Q']}).encode(), method='POST')
req.add_header('X-Sandbox-Token', '${SANDBOX_TOKEN:-}')
urllib.request.urlopen(req, timeout=8).read()
" >/dev/null 2>&1 &
done
measure "30x pacman -Q (paralel)"
wait

echo "== Skenario timeout (permintaan cepat berulang) =="
for _ in $(seq 1 50); do
  docker compose --profile sandbox exec -T "$SVC" python -c "
import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8080/exec', data=json.dumps({'command':'whoami','args':[]}).encode(), method='POST')
req.add_header('X-Sandbox-Token', '${SANDBOX_TOKEN:-}')
urllib.request.urlopen(req, timeout=8).read()
" >/dev/null 2>&1 &
done
wait
measure "setelah beban 50 req"

echo ""
echo "Limit terkonfigurasi:"
docker inspect -f '  mem : {{.HostConfig.Memory}} byte | cpu: {{.HostConfig.NanoCpus}} | pids: {{.HostConfig.PidsLimit}}' "$S"
