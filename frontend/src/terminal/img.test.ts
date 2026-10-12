import { describe, expect, it } from "vitest";
import {
  iipImage,
  splitWelcomeMarker,
  wrapTextPx,
  WELCOME_MARKER,
  ABOUT_START,
  ABOUT_END,
  PROJECT_START_PREFIX,
  PROJECT_END,
  holdTail,
  canvasLinkBand,
} from "./img";

/** ctx palsu: setiap karakter = 10px (tanpa canvas asli di jsdom). */
const fakeCtx = {
  measureText: (s: string) => ({ width: s.length * 10 }),
} as unknown as CanvasRenderingContext2D;

describe("wrapTextPx (word-aware)", () => {
  it("memotong di spasi, bukan di tengah kata", () => {
    // "hello world foo" = 15 chars = 150px; kolom 120px → "hello world" + "foo"
    expect(wrapTextPx(fakeCtx, "hello world foo", 120)).toEqual(["hello world", "foo"]);
  });

  it("tidak membelah kata pada bio kalimat panjang", () => {
    const text = "developing web applications and backend systems";
    const lines = wrapTextPx(fakeCtx, text, 200); // 20 chars per baris
    for (const l of lines) {
      // setiap baris ≤ 20 karakter dan tidak berakhir di tengah kata
      expect(l.length).toBeLessThanOrEqual(20);
    }
    // Gabungan kata tetap utuh (spasi dinormalkan saat join)
    expect(lines.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  it("hard-break hanya untuk kata yang lebih panjang dari kolom", () => {
    expect(wrapTextPx(fakeCtx, "abcdefghijklmnop", 100)).toEqual(["abcdefghij", "klmnop"]);
  });

  it("baris kosong tetap kosong", () => {
    expect(wrapTextPx(fakeCtx, "", 100)).toEqual([""]);
  });
});

describe("iipImage (protokol iTerm2 inline image)", () => {
  it("menyertakan size wajib dan lebar piksel", () => {
    expect(iipImage("QUJD", 320, 3)).toBe(
      "\x1b]1337;File=inline=1;size=3;width=320px;preserveAspectRatio=1:QUJD\x07",
    );
  });
});

describe("splitWelcomeMarker (clear → render ulang welcome)", () => {
  it("mendeteksi penanda dan membagi chunk", () => {
    const chunk = "\x1b[2J\x1b[H" + WELCOME_MARKER + "[visitor@imam-portfolio ~]$ ";
    const r = splitWelcomeMarker(chunk);
    expect(r.welcome).toBe(true);
    expect(r.pre).toBe("\x1b[2J\x1b[H");
    expect(r.post).toBe("[visitor@imam-portfolio ~]$ ");
  });

  it("chunk tanpa penanda diteruskan utuh", () => {
    const r = splitWelcomeMarker("echo halo\r\n");
    expect(r.welcome).toBe(false);
    expect(r.pre).toBe("echo halo\r\n");
    expect(r.post).toBe("");
  });

  it("ABOUT_START/END membungkus blok teks about", () => {
    const chunk = "a" + ABOUT_START + "isi-about" + ABOUT_END + "z";
    expect(chunk.indexOf(ABOUT_START)).toBeGreaterThan(-1);
    expect(chunk.indexOf(ABOUT_END)).toBeGreaterThan(chunk.indexOf(ABOUT_START));
    // Marker tidak berisi newline sehingga aman diproses per-chunk
    expect(ABOUT_START).not.toContain("\n");
    expect(ABOUT_END).not.toContain("\n");
  });

  it("PROJECT_START_PREFIX/END aman per-chunk", () => {
    const chunk = PROJECT_START_PREFIX + "11\x07blok" + PROJECT_END + "z";
    expect(chunk.indexOf(PROJECT_START_PREFIX)).toBe(0);
    expect(chunk.indexOf(PROJECT_END)).toBeGreaterThan(0);
    expect(PROJECT_START_PREFIX).not.toContain("\n");
    expect(PROJECT_END).not.toContain("\n");
  });

  it("canvasLinkBand memetakan baris teks canvas ke baris buffer", () => {
    // Gambar 10 baris mulai baris 5; teks di px 100, sel tinggi 20 → baris 10.
    const b = canvasLinkBand("https://x.dev", 5, 10, 100, 70, 140, 7, 20, 80);
    expect(b.fromY).toBe(10);
    expect(b.toY).toBe(10);
    expect(b.x1).toBe(11); // floor(70/7)+1
    expect(b.x2).toBe(30); // ceil(210/7)
    // clamp: offset melebihi tinggi gambar → baris terakhir gambar
    const c = canvasLinkBand("u", 5, 10, 9999, 0, 10, 7, 20, 80);
    expect(c.fromY).toBe(14); // 5 + (10-1)
    expect(c.x1).toBe(1);
    // clamp kolom kanan ke lebar terminal
    const d = canvasLinkBand("u", 1, 1, 0, 700, 140, 7, 20, 40);
    expect(d.x2).toBe(40);
  });

  it("holdTail menahan awal penanda yang terpotong batas frame", () => {
    const markers = [WELCOME_MARKER, ABOUT_START, ABOUT_END, PROJECT_START_PREFIX, PROJECT_END];
    const partial = WELCOME_MARKER.slice(0, 12);
    expect(holdTail("teks output " + partial, markers)).toBe(partial);
    expect(holdTail("teks output lengkap\r\n", markers)).toBe("");
    // Penanda terbelah dua frame → potongan awal ditahan, gabungannya utuh
    const half1 = PROJECT_START_PREFIX.slice(0, 10);
    const half2 = PROJECT_START_PREFIX.slice(10);
    expect(holdTail("teks " + half1, markers)).toBe(half1);
    expect(half1 + half2).toBe(PROJECT_START_PREFIX);
  });
});

