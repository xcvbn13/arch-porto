import { describe, expect, it } from "vitest";
import { iipImage, splitWelcomeMarker, WELCOME_MARKER } from "./img";

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
});

