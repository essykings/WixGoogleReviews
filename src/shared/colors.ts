// The owner's colours and how they turn into a palette. No themes: a white background and the colours of the reference
// design are the defaults, and the owner changes any of them. Pure, so it is unit-tested.

export interface Colors {
  background: string;
  card: string;
  text: string;
  star: string;
  button: string;
}

export const DEFAULT_COLORS: Colors = {
  background: '#ffffff',
  card: '#f4f5f7',
  text: '#212121',
  star: '#ff8a00',
  button: '#212121',
};

export const COLOR_KEYS = ['background', 'card', 'text', 'star', 'button'] as const;

export function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

/** Owner colours are stored as '' (use the default) or #rrggbb. */
export function cleanColors(v: unknown): Colors {
  const r = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const out = {} as Colors;
  for (const k of COLOR_KEYS) out[k] = isHex(r[k]) ? (r[k] as string) : '';
  return out;
}

/** The colours actually used: the owner's where set, the defaults elsewhere. */
export function resolveColors(overrides: Partial<Colors>): Colors {
  const out = {} as Colors;
  for (const k of COLOR_KEYS) out[k] = isHex(overrides[k]) ? (overrides[k] as string) : DEFAULT_COLORS[k];
  return out;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Black or white text, whichever reads better on this colour. */
export function onColor(hex: string): string {
  return luminance(hex) > 0.4 ? '#111111' : '#ffffff';
}
