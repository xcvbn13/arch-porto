/** Style terminal (dari API) → opsi tema xterm. */

export interface TerminalStyle {
  background: string;
  foreground: string;
  accent: string;
  cursor: string;
  font_size: number;
  blink: boolean;
  font_family: string;
  font_weight: string;
  letter_spacing: number;
  line_height: number;
  padding: number;
  cursor_style: "block" | "bar" | "underline";
  selection_color: string;
  opacity: number;
}

export const DEFAULT_STYLE: TerminalStyle = {
  background: "#0c0f14",
  foreground: "#d4d9e0",
  accent: "#00d787",
  cursor: "#00d787",
  font_size: 14,
  blink: true,
  font_family: "JetBrains Mono",
  font_weight: "normal",
  letter_spacing: 0,
  line_height: 1.0,
  padding: 8,
  cursor_style: "block",
  selection_color: "#2a313d",
  opacity: 1,
};

/** Preset tema sekali-klik — mengisi seluruh warna/style. */
export const THEME_PRESETS: Record<string, Partial<TerminalStyle>> = {
  "Arch Dark (default)": {
    background: "#0c0f14",
    foreground: "#d4d9e0",
    accent: "#00d787",
    cursor: "#00d787",
    selection_color: "#2a313d",
    opacity: 1,
  },
  Nord: {
    background: "#2e3440",
    foreground: "#d8dee9",
    accent: "#88c0d0",
    cursor: "#d8dee9",
    selection_color: "#4c566a",
    opacity: 1,
  },
  "One Dark": {
    background: "#282c34",
    foreground: "#abb2bf",
    accent: "#98c379",
    cursor: "#528bff",
    selection_color: "#3e4451",
    opacity: 1,
  },
  Gruvbox: {
    background: "#282828",
    foreground: "#ebdbb2",
    accent: "#b8bb26",
    cursor: "#ebdbb2",
    selection_color: "#504945",
    opacity: 1,
  },
  Catppuccin: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    accent: "#a6e3a1",
    cursor: "#f5e0dc",
    selection_color: "#45475a",
    opacity: 1,
  },
  Solarized: {
    background: "#002b36",
    foreground: "#839496",
    accent: "#2aa198",
    cursor: "#93a1a1",
    selection_color: "#073642",
    opacity: 1,
  },
};

const BASE_PALETTE = {
  black: "#1a2029",
  red: "#ff6b6b",
  yellow: "#ffd166",
  blue: "#4f8cff",
  magenta: "#c792ea",
  cyan: "#35c9e8",
  white: "#d4d9e0",
  brightBlack: "#7a8494",
  brightRed: "#ff6b6b",
  brightYellow: "#ffd166",
  brightBlue: "#4f8cff",
  brightMagenta: "#c792ea",
  brightCyan: "#35c9e8",
  brightWhite: "#ffffff",
};

/**
 * Terjemahkan style yang dikonfigurasi ke tema xterm: warna utama mengikuti
 * style; hijau ANSI (paling sering dipakai output) = warna accent.
 */
export function buildTheme(style: TerminalStyle) {
  return {
    ...BASE_PALETTE,
    background: style.background,
    foreground: style.foreground,
    cursor: style.cursor,
    cursorAccent: style.background,
    selectionBackground: style.selection_color,
    green: style.accent,
    brightGreen: style.accent,
  };
}

/** Font family dari nama → stack CSS monospace. */
export function fontStack(name: string): string {
  const map: Record<string, string> = {
    "JetBrains Mono": '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    "Fira Code": '"Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    "ui-monospace": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    Menlo: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    Consolas: 'Consolas, Monaco, Menlo, "Courier New", monospace',
    monospace: "monospace",
  };
  return map[name] ?? map["JetBrains Mono"];
}

/** Hex 6 digit → [r,g,b] (null bila invalid). */
export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Campur dua hex dengan bobot t (0..1) → hex baru. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a) ?? [0, 0, 0];
  const cb = hexToRgb(b) ?? [255, 255, 255];
  const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Sekuens ANSI truecolor (untuk fallback teks banner). */
export function rgbFg(rgb: [number, number, number] | null, text: string): string {
  if (!rgb) return text;
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[0m`;
}

/** Warna banner canvas dari style: header=accent, separator=foreground redup. */
export function bannerColors(style: TerminalStyle) {
  return {
    bg: style.background,
    fg: style.foreground,
    accent: style.accent,
    dim: mixHex(style.foreground, style.background, 0.5),
  };
}
