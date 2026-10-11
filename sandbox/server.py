#!/usr/bin/env python3
"""
Sandbox Arch — HTTP service internal (hanya dijangkau backend Laravel).

Keamanan:
- Hanya POST /exec dengan payload JSON terstruktur {command, args}.
- Token bersama lewat header X-Sandbox-Token.
- Allowlist command ketat (allowlist.py) — TIDAK ada shell/exec arbitrer.
- Batas ukuran payload, jumlah argumen, dan output.
- Tidak ada request log (tidak mencatat input pengunjung).
- Container: non-root, read-only rootfs, tanpa network eksternal, resource
  limits (lihat docker-compose.yml).

Mode selftest:  python server.py --selftest  (assertions offline)
"""

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from allowlist import execute_command

TOKEN = os.environ.get("SANDBOX_TOKEN", "")
MAX_OUTPUT = int(os.environ.get("SANDBOX_OUTPUT_LIMIT", "65536"))
MAX_BODY = 16384
MAX_ARGS = 8
MAX_ARG_LEN = 512
LISTEN = ("0.0.0.0", int(os.environ.get("SANDBOX_PORT", "8080")))

# Batas konkurensi eksekusi: cegah lonjakan subprocess paralel yang bisa
# menghabiskan memori (mis. 30 pacman -Q bersamaan memicu OOM pada 128 MiB).
MAX_CONCURRENT = int(os.environ.get("SANDBOX_MAX_CONCURRENT", "4"))
_exec_semaphore = threading.BoundedSemaphore(MAX_CONCURRENT)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_POST(self):  # noqa: N802
        if self.path != "/exec":
            return self._json(404, {"error": "not_found"})

        if self.headers.get("X-Sandbox-Token", "") != TOKEN or TOKEN == "":
            return self._json(401, {"error": "unauthorized"})

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self._json(400, {"error": "invalid_length"})
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"error": "payload_too_large"})

        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self._json(400, {"error": "invalid_json"})

        if not isinstance(body, dict):
            return self._json(400, {"error": "invalid_payload"})

        command = body.get("command")
        args = body.get("args", [])
        if not isinstance(command, str) or len(command) > 64:
            return self._json(400, {"error": "invalid_command"})
        if not isinstance(args, list) or len(args) > MAX_ARGS:
            return self._json(400, {"error": "invalid_args"})
        if any(not isinstance(a, str) or len(a) > MAX_ARG_LEN for a in args):
            return self._json(400, {"error": "invalid_args"})

        if not _exec_semaphore.acquire(blocking=False):
            return self._json(429, {"error": "busy — try again shortly"})
        try:
            ok, output, error = execute_command(command, args)
        finally:
            _exec_semaphore.release()
        if not ok:
            return self._json(422, {"error": error})

        if len(output) > MAX_OUTPUT:
            output = output[:MAX_OUTPUT] + "\n[output truncated]"
        return self._json(200, {"output": output})

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            return self._json(200, {"status": "ok"})
        return self._json(404, {"error": "not_found"})

    def _json(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(data)
        except BrokenPipeError:
            pass

    def log_message(self, *args):  # tidak mencatat request (privasi + noise)
        pass


def main():
    if "--selftest" in sys.argv:
        from tests_selftest import run

        sys.exit(run())

    server = ThreadingHTTPServer(LISTEN, Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
