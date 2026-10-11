import { describe, expect, it } from "vitest";
import { buildTheme, DEFAULT_STYLE, bannerColors, mixHex } from "./style";

describe("buildTheme (style → tema xterm)", () => {
  it("memetakan warna utama dari style", () => {
    const theme = buildTheme({
      background: "#101820",
      foreground: "#eeeeee",
      accent: "#4f8cff",
      cursor: "#ff6b6b",
      font_size: 16,
      blink: false,
      font_family: "Fira Code",
      font_weight: "bold",
      letter_spacing: 1,
      line_height: 1.2,
      padding: 12,
      cursor_style: "bar",
      selection_color: "#335577",
      opacity: 0.9,
    });
    expect(theme.background).toBe("#101820");
    expect(theme.foreground).toBe("#eeeeee");
    expect(theme.cursor).toBe("#ff6b6b");
    expect(theme.green).toBe("#4f8cff"); // ANSI hijau = accent
    expect(theme.brightGreen).toBe("#4f8cff");
  });

  it("default tetap gaya gelap hijau", () => {
    const theme = buildTheme(DEFAULT_STYLE);
    expect(theme.background).toBe("#0c0f14");
    expect(theme.green).toBe("#00d787");
  });

  it("bannerColors mengikuti style (header=accent, dim=campuran)", () => {
    const c = bannerColors({
      background: "#ffffff",
      foreground: "#000000",
      accent: "#4f8cff",
      cursor: "#000000",
      font_size: 14,
      blink: true,
      font_family: "JetBrains Mono",
      font_weight: "normal",
      letter_spacing: 0,
      line_height: 1,
      padding: 8,
      cursor_style: "block",
      selection_color: "#2a313d",
      opacity: 1,
    });
    expect(c.bg).toBe("#ffffff");
    expect(c.accent).toBe("#4f8cff");
    expect(c.dim).toBe(mixHex("#000000", "#ffffff", 0.5));
    expect(c.dim).not.toBe("#7a8494"); // tidak lagi hardcoded
  });
});
