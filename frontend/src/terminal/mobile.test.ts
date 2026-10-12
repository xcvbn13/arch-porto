import { describe, expect, it } from "vitest";
import { isVerticalLayout, mobileFontSize, MOBILE_FONT_MAX, VERTICAL_LAYOUT_COLS } from "./mobile";

describe("penyesuaian mobile", () => {
  it("font dibatasi hanya di perangkat sentuh", () => {
    expect(mobileFontSize(14, true)).toBe(MOBILE_FONT_MAX);
    expect(mobileFontSize(10, true)).toBe(10);
    expect(mobileFontSize(14, false)).toBe(14);
  });

  it("canvas vertikal hanya saat kolom terminal sempit", () => {
    expect(isVerticalLayout(VERTICAL_LAYOUT_COLS - 1)).toBe(true);
    expect(isVerticalLayout(VERTICAL_LAYOUT_COLS)).toBe(false);
    expect(isVerticalLayout(140)).toBe(false);
  });
});
