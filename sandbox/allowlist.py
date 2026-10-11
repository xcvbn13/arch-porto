#!/usr/bin/env python3
"""
ALLOWLIST command untuk sandbox Arch — otoritas akhir.
Setiap command memiliki SATU handler tetap yang hanya menerima argumen
tervalidasi. Tidak ada shell interpreter, tidak ada exec dengan input
pengguna, tidak ada metacharacter yang bisa lolos (subprocess memakai
argv list, shell=False).

Filesystem: hanya /home/visitor (read-only saat runtime, dibatasi compose).
Path divalidasi dengan realpath agar traversal dan symlink escape ditolak.
"""

import getpass
import os
import platform
import re
import subprocess

ALLOWED_ROOT = "/home/visitor"
MINIMAL_ENV = {"PATH": "/usr/bin:/bin", "HOME": ALLOWED_ROOT, "TERM": "xterm-256color", "LANG": "C"}
PACKAGE_PATTERN = re.compile(r"^[A-Za-z0-9@._+\-]{1,128}$")
PATH_PATTERN = re.compile(r"^[A-Za-z0-9._/\-]{1,512}$")

HELP_TEXT = """Available sandbox commands (read-only, allowlisted):
  help          this help
  whoami        current user (non-root 'visitor')
  pwd           working directory
  ls [path]     list /home/visitor contents
  cat <path>    print allowed file
  uname         kernel/host info
  fastfetch     real Arch fastfetch output
  pacman -Q     list installed packages (real metadata)
  pacman -Qi <pkg>  package details

No shell interpreter is exposed. Every command is a fixed handler.
"""


def _reject(msg):
    return False, "", msg


def _resolve(path_arg: str):
    """Validasi path: charset aman, tanpa komponen '..', realpath di dalam
    ALLOWED_ROOT (menolak symlink escape). Return path absolut atau None."""
    if not PATH_PATTERN.match(path_arg):
        return None
    if ".." in path_arg.split("/"):
        return None
    candidate = os.path.join(ALLOWED_ROOT, path_arg.lstrip("/"))
    real = os.path.realpath(candidate)
    if real != ALLOWED_ROOT and not real.startswith(ALLOWED_ROOT + "/"):
        return None
    return real


def _run_fixed(argv, timeout=5):
    """Jalankan binary dengan argv FIXED (tanpa input pengguna) — shell=False."""
    try:
        proc = subprocess.run(
            argv,
            capture_output=True,
            timeout=timeout,
            env=MINIMAL_ENV,
            cwd=ALLOWED_ROOT,
        )
    except subprocess.TimeoutExpired:
        return False, "", f"{argv[0]}: timed out"
    except FileNotFoundError:
        return False, "", f"{argv[0]}: not available in sandbox image"
    out = (proc.stdout or proc.stderr).decode("utf-8", errors="replace")
    return True, out, ""


def h_help(args):
    if args:
        return _reject("help: takes no arguments")
    return True, HELP_TEXT, ""


def h_whoami(args):
    if args:
        return _reject("whoami: takes no arguments")
    return True, getpass.getuser() + "\n", ""


def h_pwd(args):
    if args:
        return _reject("pwd: takes no arguments")
    return True, ALLOWED_ROOT + "\n", ""


def h_uname(args):
    if args:
        return _reject("uname: options are not supported")
    info = platform.uname()
    return True, f"{info.system} {info.node} {info.release} {info.machine}\n", ""


def h_ls(args):
    if len(args) > 1:
        return _reject("ls: too many arguments")
    path = _resolve(args[0]) if args else ALLOWED_ROOT
    if path is None:
        return _reject(f"ls: cannot access '{args[0]}': path not allowed")
    if not os.path.isdir(path):
        return _reject(f"ls: cannot access '{args[0]}': No such file or directory")
    names = []
    for entry in sorted(os.listdir(path)):
        names.append(entry + "/" if os.path.isdir(os.path.join(path, entry)) else entry)
    return True, "  ".join(names) + "\n", ""


def h_cat(args):
    if len(args) != 1:
        return _reject("cat: exactly one path argument is required")
    if os.path.islink(os.path.join(ALLOWED_ROOT, args[0].lstrip("/"))):
        return _reject(f"cat: {args[0]}: symlinks are not allowed")
    path = _resolve(args[0])
    if path is None:
        return _reject(f"cat: {args[0]}: path not allowed (traversal or outside sandbox)")
    if not os.path.isfile(path):
        return _reject(f"cat: {args[0]}: No such file or directory")
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return True, fh.read(), ""


def h_fastfetch(args):
    if args:
        return _reject("fastfetch: options are not supported")
    ok, out, err = _run_fixed(["fastfetch"])
    return (ok, out, err) if ok else _reject(err)


def h_pacman(args):
    if args == ["-Q"]:
        ok, out, err = _run_fixed(["pacman", "-Q"])
        if not ok:
            return _reject(err)
        return True, out if out.strip() else "(no packages)\n", ""
    if len(args) == 2 and args[0] == "-Qi" and PACKAGE_PATTERN.match(args[1]):
        ok, out, err = _run_fixed(["pacman", "-Qi", args[1]])
        if not ok:
            return _reject(err)
        return True, out if out.strip() else f"error: package '{args[1]}' was not found\n", ""
    return _reject("pacman: only '-Q' and '-Qi <package>' are supported")


# HANYA daftar ini yang bisa dieksekusi — titik audit utama sandbox.
HANDLERS = {
    "help": h_help,
    "whoami": h_whoami,
    "pwd": h_pwd,
    "ls": h_ls,
    "cat": h_cat,
    "uname": h_uname,
    "fastfetch": h_fastfetch,
    "pacman": h_pacman,
}


def execute_command(command, args):
    handler = HANDLERS.get(command)
    if handler is None:
        return _reject(f"command '{command}' is not allowed")
    try:
        return handler(args)
    except Exception as exc:  # noqa: BLE001 — jangan bocorkan detail
        return _reject(f"internal error: {type(exc).__name__}")
