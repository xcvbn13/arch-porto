#!/usr/bin/env bash
# ============================================================================
# Uji keamanan sandbox Arch — jalankan dari root repo setelah sandbox aktif:
#   docker compose --profile sandbox up -d --build
#   sandbox/tests/security_tests.sh
# Keluar dengan kode != 0 jika ada yang gagal.
# ============================================================================
set -u
cd "$(dirname "$0")/../.."

# Muat .env (token, dll.) jika ada
if [ -f .env ]; then set -a; . ./.env; set +a; fi

SVC="sandbox"        # nama service di compose
C="portfolio-sandbox" # nama container
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ok  $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1"; }
check() { # check "<deskripsi>" <perintah> <pola-yang-diharapkan>
  local desc="$1" out
  out=$(eval "$2" 2>&1)
  if echo "$out" | grep -qE "$3"; then ok "$desc"; else bad "$desc — got: $(echo "$out" | head -2 | tr '\n' ' ')"; fi
}

echo "== 1. Selftest offline (di dalam container) =="
SELFOUT=$(docker compose --profile sandbox exec -T "$SVC" python /opt/portfolio-sandbox/server.py --selftest 2>&1)
echo "$SELFOUT" | grep -q "all selftests passed" && ok "selftest passed" || { bad "selftest failed"; echo "$SELFOUT" | grep -E "FAIL" || true; }

echo "== 2. Uji HTTP (allowlist + auth, dari dalam container) =="
PYOUT=$(docker compose --profile sandbox exec -T "$SVC" python - "$SANDBOX_TOKEN" <<'PYEOF'
import sys, json, urllib.request, urllib.error

TOKEN = sys.argv[1]
BASE = "http://127.0.0.1:8080"

def post(payload, token=True, raw=None):
    data = raw if raw is not None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + "/exec", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-Sandbox-Token", TOKEN)
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except Exception:
            body = {}
        return e.code, body
    except Exception as e:
        return -1, {"error": str(e)}

def expect(label, code, resp, check_body=None):
    ok = resp[0] == code and (check_body is None or check_body(resp[1]))
    print(("ok:" if ok else "FAIL:") + label)
    if not ok:
        print("FAIL:  detail: %s %s" % (resp[0], str(resp[1])[:120]))

# Auth
expect("tanpa token ditolak 401", 401, post({"command": "whoami", "args": []}, token=False))
expect("JSON rusak ditolak 400", 400, post(None, raw=b"{bad json"))

# Allowlist command
for cmd, args in [("bash", []), ("sh", ["-c", "id"]), ("rm", ["-rf", "/"]),
                  ("touch", ["/x"]), ("nc", []), ("python", ["-c", "print(1)"]),
                  ("id", [])]:
    expect(f"command '{cmd}' ditolak 422", 422, post({"command": cmd, "args": args}))

# Metacharacters + traversal + symlink
for path in ["../../etc/passwd", "/etc/passwd", "a; rm -rf /", "a|nc x",
             "`id`", "$(id)", "escape-link.txt", "/proc/self/environ"]:
    expect(f"cat '{path[:24]}' ditolak 422", 422, post({"command": "cat", "args": [path]}))

# pacman
expect("pacman -S ditolak 422", 422, post({"command": "pacman", "args": ["-S", "vim"]}))
expect("pacman -Qi metachar ditolak 422", 422, post({"command": "pacman", "args": ["-Qi", "x; rm"]}))
expect("uname -a ditolak 422", 422, post({"command": "uname", "args": ["-a"]}))

# Command sah
expect("whoami -> visitor", 200, post({"command": "whoami", "args": []}),
       lambda b: b.get("output", "").strip() == "visitor")
expect("pwd -> /home/visitor", 200, post({"command": "pwd", "args": []}),
       lambda b: "/home/visitor" in b.get("output", ""))
expect("ls berisi welcome.txt", 200, post({"command": "ls", "args": []}),
       lambda b: "welcome.txt" in b.get("output", ""))
expect("cat welcome.txt berhasil", 200, post({"command": "cat", "args": ["welcome.txt"]}),
       lambda b: "Arch" in b.get("output", ""))
expect("pacman -Q berhasil", 200, post({"command": "pacman", "args": ["-Q"]}),
       lambda b: len(b.get("output", "")) > 0)
expect("pacman -Qi python berhasil", 200, post({"command": "pacman", "args": ["-Qi", "python"]}),
       lambda b: "python" in b.get("output", "").lower())
expect("fastfetch berhasil", 200, post({"command": "fastfetch", "args": []}),
       lambda b: len(b.get("output", "")) > 100)

# Batas output
resp = post({"command": "pacman", "args": ["-Q"]})
out = resp[1].get("output", "") if resp[0] == 200 else ""
if 0 < len(out.encode()) <= 65536 + 64:
    print("ok:batas output dipatuhi (%d byte)" % len(out.encode()))
else:
    print("FAIL:batas output dilanggar (%d byte)" % len(out.encode()))
PYEOF
)
echo "$PYOUT" | sed 's/^/  /'

echo "== 3. Hardening container (docker inspect) =="
check "read_only rootfs"          "docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' $C" "^true$"
check "no-new-privileges"         "docker inspect -f '{{.HostConfig.SecurityOpt}}' $C" "no-new-privileges"
check "cap_drop ALL"              "docker inspect -f '{{.HostConfig.CapDrop}}' $C" "ALL"
check "pids_limit 64"             "docker inspect -f '{{.HostConfig.PidsLimit}}' $C" "^64$"
check "mem_limit 256m"            "docker inspect -f '{{.HostConfig.Memory}}' $C" "^268435456$"
check "cpu 0.5"                   "docker inspect -f '{{.HostConfig.NanoCpus}}' $C" "^500000000$"
check "non-root user (visitor)"   "docker exec $C id -u" "^1000$"
check "tidak ada docker.sock"     "docker exec $C sh -c 'ls /var/run/docker.sock 2>&1'" "No such file"
check "tidak ada privilege"       "docker inspect -f '{{.HostConfig.Privileged}}' $C" "^false$"

echo "== 4. Read-only filesystem (verifikasi OS) =="
if docker exec "$C" sh -c 'touch /home/visitor/__test 2>&1' | grep -q "Read-only file system"; then
  ok "write ke /home/visitor diblokir OS"
else
  bad "write ke /home/visitor TIDAK diblokir"
fi

echo "== 5. Sandbox tidak dijangkau dari luar (tanpa port publish) =="
if docker inspect -f '{{json .HostConfig.PortBindings}}' "$C" | grep -q '8080'; then
  bad "port sandbox terpublish!"
else
  ok "tidak ada port yang dipublish"
fi

echo ""
echo "Hasil: $PASS ok, $FAIL gagal"
[ "$FAIL" -eq 0 ]
