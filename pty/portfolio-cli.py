#!/usr/bin/python
"""
Dispatcher command portfolio di dalam shell Arch (read-only).

Setiap command portfolio adalah symlink /opt/bin/<nama> → script ini;
subcommand = basename argv[0]. HTTP HANYA ke backend internal dengan URL
tetap di kode — argumen pengunjung (id, kategori, nama) tetap divalidasi
backend. 'config-admin' TERSEMBUNYI (tidak tercantum di 'help').
"""
import getpass
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE = "http://backend:8080/api/v1"
CMD = os.path.basename(sys.argv[0] or "") or (sys.argv[1] if len(sys.argv) > 1 else "")
ARGS = sys.argv[1:] if CMD == os.path.basename(sys.argv[0]) else sys.argv[2:]
TIMEOUT = 8

GREEN = "\x1b[32m"
CYAN = "\x1b[36m"
DIM = "\x1b[2m"
RED = "\x1b[31m"
YELLOW = "\x1b[33m"
BOLD = "\x1b[1m"
RST = "\x1b[0m"

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


def clean(s):
    """Buang ANSI dari data API — output tak tepercaya tidak boleh mengubah terminal."""
    return ANSI_RE.sub("", str(s))


def get(path):
    req = urllib.request.Request(BASE + path, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))["data"]


def post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))["data"]


def err(msg):
    print(f"{RED}{msg}{RST}")


def note(msg):
    print(f"{DIM}{msg}{RST}")


def osc8(url, text):
    return f"\x1b]8;;{url}\x1b\\{text}\x1b]8;;\x1b\\"


def wrap(text, width=80):
    out = []
    for raw in str(text).split("\n"):
        if len(raw) <= width:
            out.append(raw)
            continue
        rest = raw.strip()
        while len(rest) > width:
            cut = rest.rfind(" ", 0, width)
            if cut < width // 2:
                cut = width
            out.append(rest[:cut].rstrip())
            rest = rest[cut:].lstrip()
        if rest:
            out.append(rest)
    return out


def profile():
    return get("/profile")


def h_about(_args):
    try:
        p = profile()
        print(f"{BOLD}{GREEN}{clean(p['name'])}{RST}")
        print(f"{CYAN}{clean(p['role'])}{RST}")
        if p.get("tagline"):
            print(DIM + clean(p["tagline"]) + RST)
        print()
        for line in wrap(clean(p["bio"])):
            print(line)
    except urllib.error.HTTPError as e:
        err(f"API error ({e.code}).")
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_skills(args):
    try:
        rows = get("/skills")
        if not rows:
            note("Belum ada data keahlian — kelola lewat config-admin.")
            return
        grouped = {}
        for s in rows:
            grouped.setdefault(s["category"], []).append(s["name"])
        filt = args[0].lower() if args else None
        if filt:
            if filt not in {k.lower(): k for k in grouped}:
                err(f"Kategori '{args[0]}' tidak dikenal.")
                print("Tersedia:", ", ".join(grouped.keys()))
                return
        for cat, names in sorted(grouped.items()):
            if filt and cat.lower() != filt:
                continue
            print(f"{CYAN}{cat}{RST}:")
            print("  " + ", ".join(names))
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_projects(args):
    try:
        if args and args[0] == "show":
            if len(args) != 2 or not args[1].isdigit():
                err("usage: projects show <id>  (lihat ID lewat 'projects')")
                return
            p = get(f"/projects/{args[1]}")
            print(f"{BOLD}{GREEN}{clean(p['title'])}{RST}" + (f" ({clean(p['year'])})" if p.get("year") else ""))
            print(DIM + "─" * 40 + RST)
            for label, key in [("Summary", "summary"), ("Problem solved", "problem"),
                               ("My contribution", "contribution"), ("Architecture", "architecture")]:
                if p.get(key):
                    print(f"{CYAN}{label}{RST}")
                    for line in wrap(clean(p[key])):
                        print("  " + line)
            if p.get("stack"):
                print(f"{CYAN}Tech stack{RST}")
                print("  " + ", ".join(p["stack"]))
            for label, key in [("Repository", "repo_url"), ("Demo", "demo_url")]:
                if p.get(key):
                    print(f"{CYAN}{label}{RST}  " + clean(p[key]))
            if p.get("metrics"):
                print(f"{CYAN}Measured results{RST}")
                for k, v in p["metrics"].items():
                    print(f"  {k}: {v}")
        else:
            page = get("/projects?page=1")
            rows = page if isinstance(page, list) else page.get("data", [])
            if not rows:
                note("Belum ada proyek — kelola lewat config-admin.")
                return
            for p in rows:
                summ = clean(p["summary"])
                if len(summ) > 64:
                    summ = summ[:61].rstrip() + "..."
                print(f"{GREEN}{p['id']:>3}{RST}  {BOLD}{clean(p['title'])}{RST}")
                print(f"     {summ}")
            note("Detail: projects show <id>")
    except urllib.error.HTTPError as e:
        err(f"Proyek tidak ditemukan (HTTP {e.code}).")
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_experience(_args):
    try:
        rows = get("/experience")
        if not rows:
            note("Belum ada data pengalaman.")
            return
        for e in rows:
            period = f"{e['period_start']} — {e.get('period_end') or 'present'}"
            print(f"{BOLD}{clean(e['role'])}{RST}")
            print(f"{CYAN}{clean(e['company'])}{RST}  {DIM}{period}{RST}")
            if e.get("summary"):
                for line in wrap(clean(e["summary"])):
                    print("  " + line)
            for h in e.get("highlights") or []:
                print(f"  {GREEN}•{RST} {clean(h)}")
            print()
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_education(_args):
    try:
        rows = get("/education")
        if not rows:
            note("Belum ada data pendidikan.")
            return
        for e in rows:
            print(f"{BOLD}{clean(e['degree'])}{RST}")
            extra = " — ".join(filter(None, [clean(e.get("field") or ""), clean(e.get("period_start") or "")]))
            print(f"{CYAN}{clean(e['institution'])}{RST}" + (f" {DIM}({extra}){RST}" if extra else ""))
            if e.get("summary"):
                for line in wrap(clean(e["summary"])):
                    print("  " + line)
            print()
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_certifications(_args):
    try:
        rows = get("/certifications")
        if not rows:
            note("Belum ada data sertifikasi.")
            return
        for c in rows:
            print(f"{BOLD}{clean(c['name'])}{RST}")
            print(f"{CYAN}{clean(c['issuer'])}{RST}" + (f"  {DIM}{clean(c['year'])}{RST}" if c.get("year") else ""))
            if c.get("credential_url"):
                print("  " + clean(c["credential_url"]))
            print()
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_publications(_args):
    try:
        rows = get("/publications")
        if not rows:
            note("Belum ada data publikasi.")
            return
        for p in rows:
            print(f"{BOLD}{clean(p['title'])}{RST}")
            if p.get("venue"):
                print(f"{CYAN}{clean(p['venue'])}{RST}" + (f"  {DIM}{clean(p['year'])}{RST}" if p.get("year") else ""))
            if p.get("url"):
                print("  " + clean(p["url"]))
            if p.get("summary"):
                for line in wrap(clean(p["summary"])):
                    print("  " + line)
            print()
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_contact(args):
    if args and args[0] == "send":
        rest = args[1:]
        if len(rest) < 3:
            err('usage: contact send "Nama" "email@x" "pesan..."')
            return
        try:
            d = post("/contact", {"name": rest[0], "email": rest[1], "message": " ".join(rest[2:])})
            print(f"{GREEN}{d['message']}{RST}")
        except urllib.error.HTTPError as e:
            if e.code == 422:
                err("Validasi gagal — periksa nama/email/pesan.")
            elif e.code == 429:
                err("Terlalu sering — tunggu sebentar.")
            else:
                err(f"Gagal mengirim (HTTP {e.code}).")
        except Exception:
            err("Backend tidak terjangkau.")
        return
    if args:
        err("usage: contact | contact send \"Nama\" \"email\" \"pesan\"")
        return
    try:
        p = profile()
        for label, key in [("Email", "email"), ("GitHub", "github_url"),
                           ("LinkedIn", "linkedin_url"), ("Website", "website_url")]:
            print(f"{CYAN}{label:9}{RST} {clean(p.get(key) or '-')}")
        note('Kirim pesan: contact send "Nama" "email" "pesan"')
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_github(_args):
    try:
        url = clean(profile().get("github_url") or "")
        if not url:
            err("GitHub belum dikonfigurasi (config-admin → Profile).")
            return
        print(osc8(url, f"{BOLD}→ {url}{RST}"))
        note("(Ctrl+Klik di terminal modern untuk membuka)")
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_resume(_args):
    try:
        url = clean(profile().get("resume_url") or "")
        if not url:
            err("URL CV belum dikonfigurasi (config-admin → Profile).")
            return
        print(osc8(url, f"{BOLD}→ {url}{RST}"))
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


def h_socials(_args):
    try:
        p = profile()
        for label, key in [("GitHub", "github_url"), ("LinkedIn", "linkedin_url"),
                           ("Website", "website_url"), ("Email", "email")]:
            print(f"{CYAN}{label:9}{RST} {clean(p.get(key) or '-')}")
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


HELP_TEXT = f"""Available commands (read-only shell Arch):

  portfolio
    about                        Professional introduction
    skills [category]            Technical skills by category
    projects [show <id>]         Featured projects
    experience                   Professional experience
    education                    Education history
    certifications               Certifications
    publications                 Publications
    contact [send ...]           Contact info / send message
    github                       Open GitHub profile
    resume                       Open resume URL
    socials                      Social links

  arch (binary asli)
    ls cat pwd whoami uname fastfetch pacman grep head wc echo date sort tr clear

  exit                          kembali ke halaman awal
"""


def h_help(_args):
    print(HELP_TEXT)


def h_config_admin(_args):
    """Tersembunyi dari help — pintu panel admin. Password TANPA echo."""
    try:
        pw = getpass.getpass("[sudo] password for visitor: ")
    except EOFError:
        print()
        return
    if not pw:
        err("Password kosong — dibatalkan.")
        return
    try:
        d = post("/admin/login", {"password": pw})
        print(f"{GREEN}Login berhasil sebagai {d['email']}.{RST}")
        print()
        print("Klik tautan ini untuk membuka panel admin:")
        print(osc8(d["enter_url"], f"{BOLD}{GREEN}→ buka /admin{RST}"))
        print(DIM + d["enter_url"] + RST)
        note("Tautan berlaku 60 detik dan hanya sekali pakai.")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            err("Sorry, try again.")
        elif e.code == 423:
            err("Locked: terlalu banyak percobaan — coba 15 menit lagi.")
        elif e.code == 429:
            err("Terlalu sering — tunggu sebentar.")
        else:
            err(f"Login gagal (HTTP {e.code}).")
    except urllib.error.URLError:
        err("Backend tidak terjangkau.")
    except Exception:
        err("Terjadi kesalahan saat memproses data.")


HANDLERS = {
    "about": h_about,
    "skills": h_skills,
    "projects": h_projects,
    "experience": h_experience,
    "education": h_education,
    "certifications": h_certifications,
    "publications": h_publications,
    "contact": h_contact,
    "github": h_github,
    "resume": h_resume,
    "socials": h_socials,
    "help": h_help,
    "config-admin": h_config_admin,
}


def main():
    handler = HANDLERS.get(CMD)
    if handler is None:
        err(f"{CMD}: command not found — ketik 'help' untuk daftar command.")
        sys.exit(127)
    handler(ARGS)


if __name__ == "__main__":
    main()
