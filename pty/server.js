#!/usr/bin/env node
/**
 * PTY bridge — xterm.js (WebSocket) <-> bash di container Arch read-only.
 *
 * Keamanan:
 * - Tiket sesi WAJIB, diverifikasi ke Laravel (jaringan internal).
 * - Origin request divalidasi lewat nginx (rate limit) + tiket acak 128-bit.
 * - Shell: bash --norc --noprofile sebagai user non-root 'visitor',
 *   PATH=/opt/bin (HANYA binary read-only yang dikurasi).
 * - rootfs read-only (write ditolak OS), tmpfs /tmp terbatas noexec.
 * - Batas sesi aktif, TTL idle, batas output per sesi.
 */
const http = require("http");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");

const PORT = parseInt(process.env.PTY_PORT || "3000", 10);
const VERIFY_URL =
  process.env.PTY_VERIFY_URL || "http://backend:8080/api/v1/pty/verify";
const MAX_SESSIONS = parseInt(process.env.PTY_MAX_SESSIONS || "20", 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.PTY_IDLE_TIMEOUT || "600000", 10);
const OUTPUT_LIMIT = parseInt(process.env.PTY_OUTPUT_LIMIT || "2097152", 10);

let active = 0;

/** Ambil style terminal dari backend (warna accent untuk prompt). */
async function fetchStyle() {
  try {
    const r = await fetch("http://backend:8080/api/v1/terminal-style", {
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) return null;
    return (await r.json()).data;
  } catch {
    return null;
  }
}

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function spawnShell(cols = 80, rows = 24, style = null) {
  // Proses bridge = root terkurung (hanya SETUID/SETGID); PTY diturunkan ke
  // visitor (uid 1000). Tanpa --norc: /home/visitor/.bashrc (read-only)
  // menonaktifkan builtin 'help' dan memasang PS1 (jika env PS1 kosong).
  // Prompt powerline: segmen user@host berlatar accent + panah + path.
  // Baris kosong di depan agar output command tidak rapat dengan prompt.
  let ps1 = "\\n\\[\\e[48;2;0;215;135m\\e[38;2;0;0;0m\\] visitor@imam-portfolio \\[\\e[49m\\e[38;2;0;215;135m\\]❯\\[\\e[0m\\] \\[\\e[38;2;212;217;224m\\]\\w\\[\\e[0m\\] \\$ ";
  const acc = style ? hexToRgb(style.accent) : null;
  const fg = style ? hexToRgb(style.foreground) : null;
  if (acc && fg) {
    ps1 =
      `\\n\\[\\e[48;2;${acc[0]};${acc[1]};${acc[2]}m\\e[38;2;0;0;0m\\] visitor@imam-portfolio ` +
      `\\[\\e[49m\\e[38;2;${acc[0]};${acc[1]};${acc[2]}m\\]❯\\[\\e[0m\\] ` +
      `\\[\\e[38;2;${fg[0]};${fg[1]};${fg[2]}m\\]\\w\\[\\e[0m\\] \\$ `;
  }
  return pty.spawn("/usr/bin/bash", ["--noprofile"], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: "/home/visitor",
    uid: 1000,
    gid: 1000,
    env: {
      PATH: "/opt/bin", // allowlist: hanya binary read-only yang dikurasi
      HOME: "/home/visitor",
      TERM: "xterm-256color",
      LANG: "C.UTF-8",
      PS1: ps1,
    },
  });
}

const wss = new WebSocketServer({ noServer: true });

const server = http.createServer((req, res) => {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.on("upgrade", async (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    socket.destroy();
    return;
  }
  if (url.pathname !== "/pty") {
    socket.destroy();
    return;
  }
  const ticket = (url.searchParams.get("ticket") || "").slice(0, 64);

  // Style + verifikasi tiket DIAMBIL SEBELUM handleUpgrade — handler message
  // harus terpasang sinkron agar input awal tidak hilang.
  let style = null;
  try {
    style = await fetchStyle();
  } catch {
    /* abaikan */
  }

  // Verifikasi tiket ke Laravel (jaringan internal, timeout 3 detik)
  fetch(`${VERIFY_URL}/${encodeURIComponent(ticket)}`, {
    signal: AbortSignal.timeout(3000),
  })
    .then((r) => {
      if (!r.ok || active >= MAX_SESSIONS) {
        socket.destroy();
        return;
      }
      active++;
      wss.handleUpgrade(req, socket, head, (ws) => {
        const term = spawnShell(80, 24, style);
        let bytesOut = 0;
        let closed = false;
        let ready = false;
        const pending = [];
        let idle = setTimeout(kill, IDLE_TIMEOUT_MS);

        function kill() {
          if (closed) return;
          closed = true;
          active--;
          clearTimeout(idle);
          try {
            term.kill();
          } catch {
            /* ignore */
          }
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }

        // Handler dipasang SEBELUM banner di-fetch; input yang tiba lebih
        // awal diantrekan lalu di-flush begitu banner terkirim.
        ws.on("message", (data) => {
          if (closed) return;
          clearTimeout(idle);
          idle = setTimeout(kill, IDLE_TIMEOUT_MS);
          try {
            const msg = data.toString();
            const m = /^\{"type":"resize","cols":(\d+),"rows":(\d+)\}$/.exec(msg);
            if (m) {
              term.resize(Math.max(20, Math.min(300, +m[1])), Math.max(5, Math.min(100, +m[2])));
            } else if (ready) {
              term.write(msg);
            } else {
              pending.push(msg);
            }
          } catch {
            kill();
          }
        });
        ws.on("close", kill);
        term.onData((d) => {
          if (closed) return;
          bytesOut += d.length;
          if (bytesOut > OUTPUT_LIMIT) {
            kill();
            return;
          }
          try {
            ws.send(d);
          } catch {
            kill();
          }
        });
        term.onExit(() => {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          if (!closed) {
            closed = true;
            active--;
          }
        });

        // Banner dirender oleh FRONTEND (canvas → IIP) sebelum prompt bash
        // muncul. Bridge cukup menyiapkan aliran PTY dan flush input awal.
        ready = true;
        for (const d of pending) {
          try {
            term.write(d);
          } catch {
            kill();
            break;
          }
        }
      });
    })
    .catch(() => socket.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`pty bridge listening on :${PORT}`);
});
