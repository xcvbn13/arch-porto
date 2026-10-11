/**
 * Util gambar inline terminal (protokol iTerm2 inline image, diparse
 * ImageAddon xterm). `size` WAJIB — parser addon membatalkan tanpa field ini.
 */
export function iipImage(b64: string, widthPx: number, size: number): string {
  return `\x1b]1337;File=inline=1;size=${size};width=${widthPx}px;preserveAspectRatio=1:${b64}\x07`;
}

/**
 * Penanda "render welcome" yang dikirim shell `clear` (dispatcher Go).
 * Frontend mendeteksi penanda ini di aliran PTY lalu merender ulang banner
 * (canvas) — tampilan identik dengan saat refresh.
 */
export const WELCOME_MARKER = "\x1b]1337;Portfolio=welcome\x07";

/** Pola clear-screen readline (Ctrl+L) — ikut memicu welcome. */
export const CLEAR_SCREEN_RE = /\x1b\[H\x1b\[2J|\x1b\[2J\x1b\[H/;

export function splitWelcomeMarker(
  chunk: string,
): { pre: string; post: string; welcome: boolean } {
  const i = chunk.indexOf(WELCOME_MARKER);
  if (i === -1) return { pre: chunk, post: "", welcome: false };
  return {
    pre: chunk.slice(0, i),
    post: chunk.slice(i + WELCOME_MARKER.length),
    welcome: true,
  };
}

/** Wrap teks ke lebar piksel maksimum (diukur presisi via canvas). */
export function wrapTextPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    let rest = line;
    while (rest.length > 0) {
      if (ctx.measureText(rest).width <= maxW) {
        out.push(rest);
        break;
      }
      let lo = 1;
      let hi = rest.length;
      let cut = 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (ctx.measureText(rest.slice(0, mid)).width <= maxW) {
          cut = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }
  return out.length ? out : [""];
}
