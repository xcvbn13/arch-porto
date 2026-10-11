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

/** Penanda blok `about` (dispatcher Go): frontend mengganti blok teks di
 * antaranya dengan satu canvas foto-kiri + teks-kanan. Klien teks murni
 * melihat teks biasa (marker OSC tidak dirender). */
export const ABOUT_START = "\x1b]1337;Portfolio=about-start\x07";
export const ABOUT_END = "\x1b]1337;Portfolio=about-end\x07";

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

/** Wrap teks ke lebar piksel maksimum (diukur presisi via canvas).
 *  Word-aware: memotong di spasi; kata yang lebih panjang dari kolom
 *  di-hard-break sebagai fallback. */
export function wrapTextPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    let rest = line.trimEnd();
    while (rest.length > 0) {
      if (ctx.measureText(rest).width <= maxW) {
        out.push(rest);
        break;
      }
      // Binary search potongan terpanjang yang muat
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
      // Word-aware: bila sisi kanan potongan masih di tengah kata,
      // mundurkan cut ke spasi terakhir. Hard-break hanya jika kata
      // tunggal memang lebih panjang dari kolom.
      let breakAt = cut;
      if (cut < rest.length && rest[cut] !== " ") {
        const prefix = rest.slice(0, cut);
        const lastSpace = prefix.lastIndexOf(" ");
        if (lastSpace > 0) breakAt = lastSpace;
      }
      out.push(rest.slice(0, breakAt).trimEnd());
      rest = rest.slice(breakAt).trimStart();
    }
  }
  return out.length ? out : [""];
}
