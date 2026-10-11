#!/usr/bin/env python3
"""
Selftest offline untuk allowlist sandbox — dijalankan di dalam container:
  python server.py --selftest
Menguji logika validasi path, allowlist, symlink, non-root, read-only fs,
dan cap output. Tes jaringan/HTTP ada di tests/security_tests.sh.
"""

import os
import sys

from allowlist import HANDLERS, execute_command

FAILURES = []


def check(name, condition):
    if condition:
        print(f"  ok  {name}")
    else:
        print(f"FAIL  {name}")
        FAILURES.append(name)


def run():
    print("sandbox selftest")

    # 1. Set command = persis allowlist spec (help, whoami, pwd, ls, cat, uname, fastfetch, pacman)
    check("allowlist matches spec", set(HANDLERS) == {
        "help", "whoami", "pwd", "ls", "cat", "uname", "fastfetch", "pacman",
    })

    # 2. Command arbitrer ditolak
    for evil in ["bash", "sh", "rm", "touch", "nc", "curl", "wget", "python", "id", "chmod"]:
        ok, _, _ = execute_command(evil, [])
        check(f"rejects '{evil}'", not ok)

    # 3. Metacharacter tidak bisa lewat (tidak ada shell yang terlibat)
    for arg in ["a; rm -rf /", "a|nc x", "`id`", "$(id)", "a && b", "/etc/passwd"]:
        ok, _, _ = execute_command("cat", [arg])
        check(f"rejects metachar '{arg[:20]}'", not ok)

    # 4. Path traversal
    ok, _, err = execute_command("cat", ["../../etc/passwd"])
    check("rejects traversal ../", not ok)
    ok, _, err = execute_command("cat", ["/etc/passwd"])
    check("rejects absolute path outside /home/visitor", not ok)

    # 5. Symlink escape (fixture escape-link.txt -> /etc/passwd)
    ok, _, err = execute_command("cat", ["escape-link.txt"])
    check("rejects symlink escape", not ok)

    # 6. File yang diizinkan bisa dibaca
    ok, out, _ = execute_command("cat", ["welcome.txt"])
    check("cat allowed file works", ok and len(out) > 0)

    # 7. whoami non-root
    ok, out, _ = execute_command("whoami", [])
    check("whoami returns visitor", ok and "visitor" in out)
    check("not running as root", os.getuid() != 0)

    # 8. Filesystem read-only saat runtime
    check("ALLOWED_ROOT is read-only", not os.access("/home/visitor", os.W_OK))
    try:
        with open("/home/visitor/__writetest", "w") as fh:
            fh.write("x")
        check("write blocked by OS", False)
    except OSError:
        check("write blocked by OS", True)

    # 9. pacman -Qi hanya nama paket valid (regex)
    ok, _, _ = execute_command("pacman", ["-Qi", "x; rm -rf /"])
    check("pacman -Qi rejects metachar package", not ok)
    ok, _, _ = execute_command("pacman", ["-S", "vim"])
    check("pacman -S rejected", not ok)

    # 10. Argumen ekstra ditolak
    ok, _, _ = execute_command("whoami", ["--all"])
    check("whoami rejects args", not ok)
    ok, _, _ = execute_command("uname", ["-a"])
    check("uname rejects options", not ok)

    # 11. ls bekerja
    ok, out, _ = execute_command("ls", [])
    check("ls lists files", ok and "welcome.txt" in out)

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s)")
        return 1
    print("\nall selftests passed")
    return 0
