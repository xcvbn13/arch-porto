import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import "@xterm/xterm/css/xterm.css";
import { api, ApiError, memoPromise } from "../terminal/api";
import { iipImage, wrapTextPx, CLEAR_SCREEN_RE, ABOUT_START, ABOUT_END, PROJECT_START_PREFIX, PROJECT_END, WELCOME_MARKER, holdTail, canvasLinkBand, type CanvasLinkBand } from "../terminal/img";
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

interface ProjectData {
  id: number;
  title: string;
  summary: string;
  description: string;
  problem: string | null;
  contribution: string | null;
  architecture: string | null;
  stack: string[];
  repo_url: string | null;
  demo_url: string | null;
  metrics: Record<string, string> | null;
  screenshots: string[] | null;
  year: string | null;
}

interface ProjectsLayoutData {
  logo_width: number;
  logo_height: number;
  gap: number;
  shot_gap: number;
  font_size: number;
  line_height: number;
  text_width: number;
}

const DEFAULT_PROJECTS_LAYOUT: ProjectsLayoutData = {
  logo_width: 180,
  logo_height: 120,
  gap: 14,
  shot_gap: 8,
  font_size: 13,
  line_height: 17,
  text_width: 420,
};

/** Style & layout jarang berubah — cukup diambil sekali per page-load,
 *  dipakai bersama oleh banner, about, dan semua canvas proyek. */
const getTerminalStyle = memoPromise(() => api.get<TerminalStyle>("/terminal-style"));
const getProjectsLayout = memoPromise(() => api.get<ProjectsLayoutData>("/projects-layout"));

/** Ukuran sel render xterm via API internal (cara yang sama dipakai addon
 *  image); fallback ke ukuran default addon bila renderer belum siap. */
function renderCellSize(term: XTerm): { w: number; h: number } {
  const core = term as unknown as {
    _core?: {
      _renderService?: { dimensions?: { css?: { cell?: { width: number; height: number } } } };
    };
  };
  const cell = core._core?._renderService?.dimensions?.css?.cell;
  return { w: cell && cell.width > 0 ? cell.width : 7, h: cell && cell.height > 0 ? cell.height : 14 };
}

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
      // Link OSC 8 diaktifkan oleh klik (tanpa modifier); tanpa handler ini
      // xterm menampilkan dialog confirm(). Hanya http(s) yang dibuka.
      linkHandler: {
        activate: (_event, uri) => {
          if (/^https?:\/\//i.test(uri)) {
            window.open(uri, "_blank", "noopener,noreferrer");
          }
        },
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    // Untuk logo fetch (IIP dari server) yang masuk lewat aliran PTY
    term.loadAddon(new ImageAddon({ pixelLimit: 1 << 24 }));
    term.open(container);
    fit.fit();

    // Overlay link untuk URL yang DIGAMBAR di dalam canvas proyek (gambar
    // tidak punya teks): provider memetakan baris buffer → URL sehingga
    // hover/klik area URL berfungsi seperti link biasa (klik → tab baru).
    const canvasLinks: CanvasLinkBand[] = [];
    term.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const hit = canvasLinks.find(
          (l) => bufferLineNumber >= l.fromY && bufferLineNumber <= l.toY,
        );
        if (!hit) {
          callback(undefined);
          return;
        }
        callback([
          {
            range: {
              start: { x: hit.x1, y: bufferLineNumber },
              end: { x: hit.x2, y: bufferLineNumber },
            },
            text: hit.uri,
            activate: (_event, uri) => {
              if (/^https?:\/\//i.test(uri)) {
                window.open(uri, "_blank", "noopener,noreferrer");
              }
            },
            hover: () => {},
            leave: () => {},
          },
        ]);
      },
    });
    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(container);
    const onWinResize = () => fit.fit();
    window.addEventListener("resize", onWinResize);

    let disposed = false;

    // Terapkan style yang dikonfigurasi pemilik (live) — fallback default.
    getTerminalStyle()
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
          getTerminalStyle().catch(() => DEFAULT_STYLE),
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
    const renderAbout = async (fallbackText: string) => {
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
          getTerminalStyle().catch(() => DEFAULT_STYLE),
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
      } catch (e) {
        /* gagal → tampilkan teks asli yang dibuffer (jangan tinggalkan kosong) */
        console.warn("[canvas about gagal]", e);
        if (fallbackText) term.write(fallbackText);
      }
    };

    /** Helper bersama: foto → HTMLImageElement. */
    const loadImage = async (url: string): Promise<HTMLImageElement> => {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      return new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode failed"));
        el.src = dataUrl;
      });
    };

    /** Placeholder gambar "no screenshot" (sadar tema), digambar di canvas
     * pada kotak w×h di posisi (x,y). */
    const paintPlaceholder = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      c: { fg: string; accent: string; dim: string },
    ) => {
      ctx.save();
      ctx.strokeStyle = c.dim;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 8);
      ctx.stroke();
      ctx.setLineDash([]);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const iw = Math.min(w * 0.5, 90);
      const ih = iw * 0.62;
      const ix = cx - iw / 2;
      const iy = cy - ih / 2 - 6;
      ctx.strokeStyle = c.dim;
      ctx.strokeRect(ix, iy, iw, ih);
      ctx.beginPath();
      ctx.moveTo(ix + 2, iy + ih - 2);
      ctx.lineTo(ix + iw * 0.35, iy + ih * 0.45);
      ctx.lineTo(ix + iw * 0.6, iy + ih - 2);
      ctx.moveTo(ix + iw * 0.48, iy + ih * 0.62);
      ctx.lineTo(ix + iw - 2, iy + ih * 0.22);
      ctx.lineTo(ix + iw - 2, iy + ih - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ix + iw * 0.78, iy + ih * 0.25, Math.max(3, ih * 0.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = c.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("no screenshot", cx, iy + ih + 8);
      ctx.restore();
    };

    /** Canvas detail proyek: screenshot kiri (stacked) + detail teks kanan. */
    const renderProject = async (id: string, fallbackText: string) => {
      try {
        const [p, layout, style] = await Promise.all([
          api.get<ProjectData>(`/projects/${id}`),
          getProjectsLayout().catch(() => DEFAULT_PROJECTS_LAYOUT),
          getTerminalStyle().catch(() => DEFAULT_STYLE),
        ]);
        const c = bannerColors(style);
        const font = `${layout.font_size}px ${fontStack(style.font_family)}`;
        const measure = document.createElement("canvas").getContext("2d");
        if (!measure) throw new Error("canvas unavailable");
        measure.font = font;

        type L = { t: string; s: "title" | "label" | "body" | "dim" };
        const lines: L[] = [
          { t: `#${p.id} ${p.title}` + (p.year ? ` (${p.year})` : ""), s: "title" },
          { t: "─".repeat(40), s: "dim" },
        ];
        const add = (label: string, body: string | null | undefined) => {
          if (!body || !body.trim()) return;
          lines.push({ t: label, s: "label" });
          for (const w of wrapTextPx(measure, body, layout.text_width - 16)) {
            lines.push({ t: "  " + w, s: "body" });
          }
        };
        add("Project Affiliation", p.summary);
        add("Description", p.description);
        add("Problem solved", p.problem);
        add("My contribution", p.contribution);
        add("Architecture", p.architecture);
        if (p.stack?.length) {
          lines.push({ t: "Tech stack", s: "label" });
          lines.push({ t: "  " + p.stack.join(", "), s: "body" });
        }
        // Baris URL ikut digambar di canvas (posisi tetap seperti semula);
        // indeksnya dicatat untuk overlay link yang bisa diklik.
        const linkLines: Array<{ uri: string; idx: number; text: string }> = [];
        if (p.repo_url) {
          lines.push({ t: "Repository", s: "label" });
          lines.push({ t: "  " + p.repo_url, s: "dim" });
          linkLines.push({ uri: p.repo_url, idx: lines.length - 1, text: "  " + p.repo_url });
        }
        if (p.demo_url) {
          lines.push({ t: "Demo", s: "label" });
          lines.push({ t: "  " + p.demo_url, s: "dim" });
          linkLines.push({ uri: p.demo_url, idx: lines.length - 1, text: "  " + p.demo_url });
        }
        if (p.metrics && Object.keys(p.metrics).length) {
          lines.push({ t: "Measured results", s: "label" });
          for (const [k, v] of Object.entries(p.metrics)) {
            lines.push({ t: `  ${k}: ${v}`, s: "body" });
          }
        }

        const shots: HTMLImageElement[] = [];
        for (const s of p.screenshots ?? []) {
          try {
            shots.push(await loadImage(s));
          } catch {
            /* lewati gambar yang gagal */
          }
        }

        const shotW = layout.logo_width;
        const shotH = layout.logo_height;
        const shotGap = layout.shot_gap;
        const rects = shots.map((img) => {
          const sc = Math.min(1, shotW / img.naturalWidth, shotH / img.naturalHeight);
          return {
            w: Math.max(16, Math.round(img.naturalWidth * sc)),
            h: Math.max(16, Math.round(img.naturalHeight * sc)),
          };
        });
        const leftTotal =
          rects.length > 0
            ? rects.reduce((a, r) => a + r.h, 0) + shotGap * (rects.length - 1)
            : shotH;
        const textTotal = lines.length * layout.line_height + 12;
        const H = Math.max(leftTotal, textTotal) + 10;
        const pad = layout.gap;
        const W = Math.ceil(shotW + pad + layout.text_width + 20);

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

        // Kolom kiri: screenshot stacked / placeholder
        let y = 5;
        if (shots.length === 0) {
          paintPlaceholder(ctx, 0, y, shotW, shotH, c);
        } else {
          for (let i = 0; i < shots.length; i++) {
            const r = rects[i];
            ctx.save();
            ctx.shadowColor = c.accent + "55";
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.roundRect(0, y, r.w, r.h, 6);
            ctx.clip();
            ctx.drawImage(shots[i], 0, y, r.w, r.h);
            ctx.restore();
            y += r.h + shotGap;
          }
        }

        // Kolom kanan: detail teks
        ctx.textBaseline = "top";
        const tx = shotW + pad;
        for (let i = 0; i < lines.length; i++) {
          const ly = 5 + i * layout.line_height;
          const l = lines[i];
          if (l.s === "title") {
            ctx.font = `bold ${font}`;
            ctx.fillStyle = c.accent;
          } else if (l.s === "label") {
            ctx.font = `bold ${font}`;
            ctx.fillStyle = c.accent;
          } else if (l.s === "dim") {
            ctx.font = font;
            ctx.fillStyle = c.dim;
          } else {
            ctx.font = font;
            ctx.fillStyle = c.fg;
          }
          ctx.fillText(l.t, tx, ly);
        }

        const png = canvas.toDataURL("image/png");
        const b64 = png.slice(png.indexOf(",") + 1);
        // Tulis gambar; posisi baris buffer dibaca di callback karena
        // parsing/penempatan gambar berjalan asinkron.
        let bottomRow0 = 0;
        let originX = 0;
        await new Promise<void>((resolve) => {
          term.write(iipImage(b64, outW, atob(b64).length), () => {
            const b = term.buffer.active;
            bottomRow0 = b.baseY + b.cursorY;
            originX = b.cursorX;
            resolve();
          });
        });
        term.write("\r\n");
        // Overlay link: canvas itu gambar (tak punya teks), jadi URL
        // Repository/Demo didaftarkan sebagai link pada baris buffer tempat
        // teks URL berada — klik → tab baru.
        const cell = renderCellSize(term);
        const imgRows = Math.max(1, Math.ceil(outH / cell.h));
        const topRow = bottomRow0 - imgRows + 2; // 1-based
        for (const ll of linkLines) {
          const wPx = measure.measureText(ll.text).width;
          canvasLinks.push(
            canvasLinkBand(
              ll.uri,
              topRow,
              imgRows,
              (5 + ll.idx * layout.line_height) * outScale,
              (shotW + pad) * outScale + originX * cell.w,
              wPx * outScale,
              cell.w,
              cell.h,
              term.cols,
            ),
          );
        }
        // ponytail: baris buffer absolut bergeser saat scrollback dipangkas;
        // link lama bisa salah baris setelah ribuan baris output. Batasi
        // jumlahnya; ganti ke marker-based kalau jadi masalah.
        if (canvasLinks.length > 120) canvasLinks.splice(0, 60);
      } catch (e) {
        /* gagal → tampilkan teks detail asli + catatan dim */
        console.warn("[canvas proyek gagal]", e);
        if (fallbackText) term.write(fallbackText);
        term.write("\x1b[2m[canvas gagal dirender — teks detail di atas]\x1b[0m\r\n");
      }
    };

    const connect = async () => {
      if (disposed) return;
      setStatus("connecting");
      try {
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
        let projectBuffer: { id: string; parts: string[] } | null = null;
        // Sisa penanda OSC yang terpotong batas frame WS.
        let pending = "";
        const HOLD_MARKERS = [PROJECT_START_PREFIX, PROJECT_END, ABOUT_START, ABOUT_END, WELCOME_MARKER];
        /** Bila akhir `t` adalah awal penanda yang terpotong, kembalikan
         *  potongan itu agar ditahan sampai frame berikutnya. */
        const holdPartial = (t: string): string => holdTail(t, HOLD_MARKERS);
        /** Proses satu frame: blok penanda pada posisi paling awal diproses
         *  lebih dulu, sehingga urutan output terjaga walau beberapa blok
         *  (mis. daftar `projects`) tiba dalam satu frame. */
        const processChunk = async (chunk0: string) => {
          let chunk = chunk0;
          while (chunk.length > 0) {
            // Blok `projects`: buffer sampai penanda akhir, lalu ganti
            // dengan canvas (screenshot kiri + detail kanan).
            if (projectBuffer !== null) {
              const e = chunk.indexOf(PROJECT_END);
              if (e === -1) {
                projectBuffer.parts.push(chunk);
                return;
              }
              projectBuffer.parts.push(chunk.slice(0, e));
              chunk = chunk.slice(e + PROJECT_END.length);
              const fallbackText = projectBuffer.parts.join("");
              const id = projectBuffer.id;
              projectBuffer = null;
              await renderProject(id, fallbackText);
              continue;
            }
            // Blok `about`: buffer teks sampai penanda akhir, lalu ganti
            // dengan satu canvas (foto kiri + teks kanan).
            if (aboutBuffer !== null) {
              const e = chunk.indexOf(ABOUT_END);
              if (e === -1) {
                aboutBuffer.push(chunk);
                return;
              }
              aboutBuffer.push(chunk.slice(0, e));
              chunk = chunk.slice(e + ABOUT_END.length);
              const fallbackText = aboutBuffer.join("");
              aboutBuffer = null;
              await renderAbout(fallbackText);
              continue;
            }
            const cands: Array<[number, "project" | "about" | "welcome"]> = [];
            const pi = chunk.indexOf(PROJECT_START_PREFIX);
            if (pi !== -1) cands.push([pi, "project"]);
            const ai = chunk.indexOf(ABOUT_START);
            if (ai !== -1) cands.push([ai, "about"]);
            const wi = chunk.indexOf(WELCOME_MARKER);
            if (wi !== -1) cands.push([wi, "welcome"]);
            cands.sort((a, b) => a[0] - b[0]);
            const hit = cands[0];
            if (!hit) {
              // Ctrl+L (clear-screen readline) tanpa penanda → welcome juga
              if (CLEAR_SCREEN_RE.test(chunk)) {
                await renderWelcome(true);
                return;
              }
              const tail = holdPartial(chunk);
              const body = tail ? chunk.slice(0, chunk.length - tail.length) : chunk;
              if (body) term.write(body);
              pending = tail;
              return;
            }
            const [idx, kind] = hit;
            if (idx > 0) {
              term.write(chunk.slice(0, idx));
              chunk = chunk.slice(idx);
            }
            if (kind === "project") {
              const afterPrefix = chunk.slice(PROJECT_START_PREFIX.length);
              const idEnd = afterPrefix.indexOf("\x07");
              if (idEnd === -1) {
                pending = chunk; // penanda terpotong — lanjut frame berikutnya
                return;
              }
              const id = afterPrefix.slice(0, idEnd);
              chunk = afterPrefix.slice(idEnd + 1);
              const e = chunk.indexOf(PROJECT_END);
              if (e !== -1) {
                const fallbackText = chunk.slice(0, e);
                chunk = chunk.slice(e + PROJECT_END.length);
                await renderProject(id, fallbackText);
                continue;
              }
              projectBuffer = { id, parts: [chunk] };
              return;
            }
            if (kind === "about") {
              const after = chunk.slice(ABOUT_START.length);
              const e = after.indexOf(ABOUT_END);
              if (e !== -1) {
                const fallbackText = after.slice(0, e);
                chunk = after.slice(e + ABOUT_END.length);
                await renderAbout(fallbackText);
                continue;
              }
              aboutBuffer = [after];
              return;
            }
            // welcome
            chunk = chunk.slice(WELCOME_MARKER.length);
            await renderWelcome(true);
          }
        };
        ws.onmessage = (ev) => {
          const data = String(ev.data);
          writeChain = writeChain.then(async () => {
            if (disposed) return;
            const merged = pending + data;
            pending = "";
            await processChunk(merged);
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
