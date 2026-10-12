/**
 * Penyesuaian mobile: font terminal lebih kecil di perangkat sentuh dan
 * canvas 2 kolom diputar vertikal bila layar sempit (teks tetap terbaca).
 */
export const MOBILE_FONT_MAX = 12;

/** Terminal "sempit" (kolom) → canvas ditata vertikal. */
export const VERTICAL_LAYOUT_COLS = 80;

export function mobileFontSize(styleFont: number, isTouch: boolean): number {
  return isTouch ? Math.min(styleFont, MOBILE_FONT_MAX) : styleFont;
}

export function isVerticalLayout(cols: number): boolean {
  return cols < VERTICAL_LAYOUT_COLS;
}
