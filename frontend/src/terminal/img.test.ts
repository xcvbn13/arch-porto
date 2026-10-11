import { describe, expect, it } from "vitest";
import {
  iipImage,
  splitWelcomeMarker,
  wrapTextPx,
  WELCOME_MARKER,
  ABOUT_START,
  ABOUT_END,
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
});

