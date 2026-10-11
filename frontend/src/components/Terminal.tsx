import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import "@xterm/xterm/css/xterm.css";
import { api, ApiError } from "../terminal/api";
import { iipImage, wrapTextPx, splitWelcomeMarker, CLEAR_SCREEN_RE, ABOUT_START, ABOUT_END } from "../terminal/img";
import {
  buildTheme,
  DEFAULT_STYLE,
  bannerColors,
  hexToRgb,
  rgbFg,
  fontStack,
  type TerminalStyle,
} from "../terminal/style";
import { mintOrReuse } from "../terminal/ptyTicket";

/**
 * Terminal halaman utama — LANGSUNG attach ke shell Arch nyata (PTY via
 * WebSocket). Tidak ada simulasi: xterm.js murni emulator tampilan.
 * Putus → sambung ulang otomatis dengan tiket baru.
 */

const THEME = buildTheme(DEFAULT_STYLE);

type Status = "connecting" | "connected" | "disconnected";

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<Status>("connecting");
  const [isTouch, setIsTouch] = useState(false);
  const [mobileInput, setMobileInput] = useState("");

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      theme: THEME,
      fontSize: 14,
      fontFamily:
        '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      cursorBlink: true,
      scrollback: 2000,
      allowTransparency: true,
      disableStdin: isTouch,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    // Untuk logo fetch (IIP dari server) yang masuk lewat aliran PTY
    term.loadAddon(new ImageAddon({ pixelLimit: 1 << 24 }));
    term.open(container);
    fit.fit();
    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(container);
    const onWinResize = () => fit.fit();
    window.addEventListener("resize", onWinResize);

    let disposed = false;

    // Terapkan style yang dikonfigurasi pemilik (live) — fallback default.
    api
      .get<TerminalStyle>("/terminal-style")
      .then((style) => {
        if (disposed) return;
        term.options.theme = buildTheme(style);
        term.options.fontSize = style.font_size;
        term.options.cursorBlink = style.blink;
        term.options.fontFamily = fontStack(style.font_family);
        const weight = /^[1-9]00$/.test(style.font_weight)
          ? Number(style.font_weight)
          : style.font_weight;
        term.options.fontWeight = weight as "normal" | "bold" | number;
        term.options.fontWeightBold =
          style.font_weight === "normal" ? "bold" : (weight as "normal" | "bold" | number);
        term.options.letterSpacing = style.letter_spacing;
        term.options.lineHeight = style.line_height;
        term.options.cursorStyle = style.cursor_style;
        if (container) {
          container.style.padding = `${style.padding}px`;
          container.style.opacity = String(style.opacity);
          container.style.setProperty("--term-accent", style.accent);
          if (isTouch) container.style.paddingBottom = "80px";
        }
        fit.fit();
      })
      .catch(() => {
        /* pakai default */
      });
    let ws: WebSocket | null = null;
    let retryTimer: number | undefined;

    const sendResize = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };
    term.onResize(sendResize);

    /**
     * Banner pembuka: logo + baris info dirender sebagai SATU gambar canvas
     * (tidak ada wrap/overlap), ditulis ke terminal sebelum shell terhubung.
     * Gagal → fallback teks atau langsung prompt bash.
     */
    const renderWelcome = async (clearFirst: boolean) => {
      if (clearFirst) term.write("\x1b[2J\x1b[H");
      try {
        const [data, style] = await Promise.all([
          api.get<{
            entries: { label: string; value: string }[];
            logo_url: string | null;
            layout?: {
              logo_width: number;
              logo_height: number;
              gap: number;
              font_size: number;
              line_height: number;
              text_width: number;
            };
          }>("/fetch"),
          api.get<TerminalStyle>("/terminal-style").catch(() => DEFAULT_STYLE),
        ]);
        const c = bannerColors(style);
        const layout = data.layout ?? {
          logo_width: 180,
          logo_height: 200,
          gap: 14,
          font_size: 13,
          line_height: 17,
          text_width: 420,
        };
        const rows = (data.entries || []).slice(0, 12);
        const lines = ["visitor@imam-portfolio", "-".repeat(22)];
        for (const r of rows) lines.push(`${r.label}: ${r.value}`);

        if (data.logo_url) {
          const res = await fetch(data.logo_url, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) throw new Error("logo fetch failed");
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("read failed"));
            reader.readAsDataURL(blob);
          });
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("decode failed"));
            el.src = dataUrl;
          });

          const font = `${layout.font_size}px ${fontStack(style.font_family)}`;
          const pad = layout.gap;
          const lineH = layout.line_height;
          const logoScale = Math.min(
            1,
            layout.logo_width / img.naturalWidth,
            layout.logo_height / img.naturalHeight,
          );
          const logoW = Math.max(24, Math.round(img.naturalWidth * logoScale));
          const logoH = Math.max(24, Math.round(img.naturalHeight * logoScale));
          const measure = document.createElement("canvas").getContext("2d");
          if (!measure) throw new Error("canvas unavailable");
          measure.font = font;
          const longest = Math.max(80, ...lines.map((l) => measure.measureText(l).width));
          const textW = Math.min(layout.text_width, Math.ceil(longest) + 4);
          const wrapped = lines.flatMap((l) => wrapTextPx(measure, l, textW));

          const W = Math.ceil(logoW + pad + textW + pad);
          const H = Math.max(logoH, wrapped.length * lineH + 10);
          const approxTermW = term.cols * 8.4;
          const outScale = Math.min(1, (approxTermW * 0.92) / W);
          const outW = Math.max(64, Math.round(W * outScale));
          const outH = Math.max(24, Math.round(H * outScale));
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(outW * dpr);
          canvas.height = Math.round(outH * dpr);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("canvas unavailable");
          ctx.scale(dpr * outScale, dpr * outScale);
          ctx.fillStyle = c.bg; // mengikuti style terminal
          ctx.fillRect(0, 0, W, H);
          // Logo dengan sudut membulat + bayangan accent halus
          const logoY = Math.round((H - logoH) / 2);
          ctx.save();
          ctx.shadowColor = c.accent + "55";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.roundRect(0, logoY, logoW, logoH, 8);
          ctx.clip();
          ctx.drawImage(img, 0, logoY, logoW, logoH);
          ctx.restore();
          ctx.textBaseline = "top";
          for (let i = 0; i < wrapped.length; i++) {
            const y = 5 + i * lineH;
            if (i === 0) {
              ctx.font = `bold ${font}`;
              const grad = ctx.createLinearGradient(logoW + pad, 0, logoW + pad + textW, 0);
              grad.addColorStop(0, c.accent);
              grad.addColorStop(1, c.fg);
              ctx.fillStyle = grad;
            } else if (i === 1) {
              ctx.font = font;
              ctx.fillStyle = c.dim;
            } else {
              ctx.font = font;
              ctx.fillStyle = c.fg;
            }
            ctx.fillText(wrapped[i], logoW + pad, y);
          }
          const png = canvas.toDataURL("image/png");
          const b64 = png.slice(png.indexOf(",") + 1);
          term.write(iipImage(b64, outW, atob(b64).length) + "\r\n");
        } else {
          const text = [
            rgbFg(hexToRgb(c.accent), "\x1b[1mvisitor@imam-portfolio\x1b[0m"),
            rgbFg(hexToRgb(c.dim), "-".repeat(22)),
          ];
          for (const r of rows) text.push(`${r.label}: ${r.value}`);
          term.write(text.join("\r\n") + "\r\n");
        }
        term.write(
          rgbFg(hexToRgb(c.dim), "Ketik 'help' untuk daftar command — 'exit' untuk keluar.") +
            "\r\n",
        );
      } catch {
        /* banner gagal → prompt bash tetap tampil */
      }
    };

    /**
     * Canvas `about`: foto profil di KIRI + teks tentang di KANAN, memakai
     * layout yang sama dengan Fetch Info (logo_width/height, gap, font_size,
     * line_height, text_width) dan warna terminal style.
     */
    const renderAbout = async () => {
      try {
        const [profile, style] = await Promise.all([
          api.get<{
            name: string;
            role: string;
            tagline: string | null;
            bio: string;
            avatar_url: string | null;
            about_layout?: {
              logo_width: number;
              logo_height: number;
              gap: number;
              font_size: number;
              line_height: number;
              text_width: number;
            };
          }>("/profile"),
          api.get<TerminalStyle>("/terminal-style").catch(() => DEFAULT_STYLE),
        ]);
        const c = bannerColors(style);
        const layout = {
          logo_width: 180,
          logo_height: 200,
          gap: 14,
          font_size: 13,
          line_height: 17,
          text_width: 420,
          ...(profile.about_layout ?? {}),
        };

        if (!profile.avatar_url) {
          // Fallback teks bila foto tidak dikonfigurasi
          term.write(
            [
              rgbFg(hexToRgb(c.accent), "\x1b[1m" + profile.name + "\x1b[0m"),
              rgbFg(hexToRgb(c.fg), profile.role),
              profile.tagline ? rgbFg(hexToRgb(c.dim), profile.tagline) : "",
              "",
              profile.bio,
            ]
              .filter((l) => l !== "")
              .join("\r\n") + "\r\n",
          );
          return;
        }

        const res = await fetch(profile.avatar_url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error("avatar fetch failed");
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(blob);
        });
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("decode failed"));
          el.src = dataUrl;
        });

        const font = `${layout.font_size}px ${fontStack(style.font_family)}`;
        const pad = layout.gap;
        const lineH = layout.line_height;
        const logoScale = Math.min(
          1,
          layout.logo_width / img.naturalWidth,
          layout.logo_height / img.naturalHeight,
        );
        const logoW = Math.max(24, Math.round(img.naturalWidth * logoScale));
        const logoH = Math.max(24, Math.round(img.naturalHeight * logoScale));

        const lines = [profile.name, profile.role, profile.tagline ?? "", ""];
        for (const l of profile.bio.split("\n")) lines.push(l);

        const measure = document.createElement("canvas").getContext("2d");
        if (!measure) throw new Error("canvas unavailable");
        measure.font = font;
        const longest = Math.max(80, ...lines.map((l) => measure.measureText(l).width));
        const textW = Math.min(layout.text_width, Math.ceil(longest) + 4);
        const wrapped = lines.flatMap((l) => wrapTextPx(measure, l, textW));

        const W = Math.ceil(logoW + pad + textW + pad);
        const H = Math.max(logoH, wrapped.length * lineH + 10);
        const approxTermW = term.cols * 8.4;
        const outScale = Math.min(1, (approxTermW * 0.92) / W);
        const outW = Math.max(64, Math.round(W * outScale));
        const outH = Math.max(24, Math.round(H * outScale));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(outW * dpr);
        canvas.height = Math.round(outH * dpr);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");
        ctx.scale(dpr * outScale, dpr * outScale);
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, W, H);
        const logoY = Math.round((H - logoH) / 2);
        ctx.save();
        ctx.shadowColor = c.accent + "55";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(0, logoY, logoW, logoH, 8);
        ctx.clip();
        ctx.drawImage(img, 0, logoY, logoW, logoH);
        ctx.restore();
        ctx.textBaseline = "top";
        for (let i = 0; i < wrapped.length; i++) {
          const y = 5 + i * lineH;
          if (i === 0) {
            ctx.font = `bold ${font}`;
            ctx.fillStyle = c.accent;
          } else if (i === 1) {
            ctx.font = font;
            ctx.fillStyle = c.fg;
          } else if (i === 2) {
            ctx.font = font;
            ctx.fillStyle = c.dim;
          } else {
            ctx.font = font;
            ctx.fillStyle = c.fg;
          }
          if (wrapped[i]) ctx.fillText(wrapped[i], logoW + pad, y);
        }
        const png = canvas.toDataURL("image/png");
        const b64 = png.slice(png.indexOf(",") + 1);
        term.write(iipImage(b64, outW, atob(b64).length) + "\r\n");
      } catch {
        /* gagal → blok teks asli sudah dibuang, tulis prompt saja */
      }
    };

    const connect = async () => {
      if (disposed) return;
      setStatus("connecting");      try {
        const ticket = await mintOrReuse(api, sessionStorage);
        if (disposed) return;
        await renderWelcome(false);
        if (disposed) return;
        const proto = location.protocol === "https:" ? "wss" : "ws";
        ws = new WebSocket(`${proto}://${location.host}/pty?ticket=${encodeURIComponent(ticket)}`);
        wsRef.current = ws;
        ws.onopen = () => {
          setStatus("connected");
          sendResize();
        };
        // Antrean serial: semua tulis ke terminal berurutan (banner async
        // tidak boleh mendahului prompt bash yang menyusul).
        let writeChain: Promise<void> = Promise.resolve();
        let aboutBuffer: string[] | null = null;
        ws.onmessage = (ev) => {
          const chunk = String(ev.data);
          writeChain = writeChain.then(async () => {
            if (disposed) return;

            // Blok `about`: buffer teks sampai penanda akhir, lalu ganti
            // dengan satu canvas (foto kiri + teks kanan).
            if (aboutBuffer !== null) {
              const e = chunk.indexOf(ABOUT_END);
              if (e === -1) {
                aboutBuffer.push(chunk);
                return;
              }
              aboutBuffer.push(chunk.slice(0, e));
              const rest = chunk.slice(e + ABOUT_END.length);
              aboutBuffer = null;
              await renderAbout();
              if (rest) term.write(rest);
              return;
            }
            const sIdx = chunk.indexOf(ABOUT_START);
            if (sIdx !== -1) {
              if (sIdx > 0) term.write(chunk.slice(0, sIdx));
              const after = chunk.slice(sIdx + ABOUT_START.length);
              const e = after.indexOf(ABOUT_END);
              if (e !== -1) {
                await renderAbout();
                const rest = after.slice(e + ABOUT_END.length);
                if (rest) term.write(rest);
              } else {
                aboutBuffer = [after];
              }
              return;
            }

            const { pre, post, welcome } = splitWelcomeMarker(chunk);
            if (welcome) {
              if (pre) term.write(pre);
              await renderWelcome(true);
              if (post) term.write(post);
              return;
            }
            // Ctrl+L (clear-screen readline) tanpa penanda → welcome juga
            if (CLEAR_SCREEN_RE.test(chunk)) {
              await renderWelcome(true);
              return;
            }
            term.write(chunk);
          });
        };
        ws.onclose = () => {
          wsRef.current = null;
          if (disposed) return;
          setStatus("disconnected");
          term.write("\r\n\x1b[31m[sesi shell berakhir — menyambung ulang…]\x1b[0m\r\n");
          retryTimer = window.setTimeout(connect, 1500);
        };
        ws.onerror = () => {
          /* onclose menyusul */
        };
      } catch (e) {
        if (disposed) return;
        setStatus("disconnected");
        const retryMs = e instanceof ApiError && e.status === 429 ? 10000 : 3000;
        const msg =
          e instanceof ApiError && e.status === 429
            ? "[sesi penuh atau terlalu sering — coba lagi dalam beberapa saat…]"
            : "[tidak bisa membuat sesi shell — mencoba lagi…]";
        term.write(`\x1b[31m${msg}\x1b[0m\r\n`);
        retryTimer = window.setTimeout(connect, retryMs);
      }
    };
    void connect();

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ro.disconnect();
      window.removeEventListener("resize", onWinResize);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouch]);

  const submitMobile = () => {
    const value = mobileInput;
    if (value === "") return;
    setMobileInput("");
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(value + "\r");
    }
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className={isTouch ? "term-container pb-20" : "term-container"}
      />
      {isTouch && (
        <div className="mobile-input-bar">
          <span className="shrink-0 text-[--term-green]">arch$</span>
          <input
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitMobile();
              }
            }}
            placeholder={
              status === "connected" ? "ketik lalu Enter" : "menyambung ke shell…"
            }
            disabled={status !== "connected"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Terminal input"
          />
          <button
            type="button"
            onClick={submitMobile}
            disabled={status !== "connected"}
            className="shrink-0 rounded border border-[--term-green] px-2 py-0.5 text-xs text-[--term-green] disabled:opacity-40"
            aria-label="Kirim ke shell"
          >
            ↵
          </button>
        </div>
      )}
    </div>
  );
}
