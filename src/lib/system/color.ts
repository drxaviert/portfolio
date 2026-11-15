/**
 * Colour maths for the token engine.
 *
 * OKLCH is the working space: it makes hue rotation and phase blending
 * perceptually even. It never reaches the DOM — output is sRGB hex/rgba only,
 * because relative-colour syntax and `oklch()` need Safari 18+ and the site
 * supports older WebKit.
 */

/** r, g, b are 0..255 (float), a is 0..1. */
export type Rgba = { r: number; g: number; b: number; a: number };

/** l is 0..1, h is degrees, a is 0..1. */
export type Oklch = { l: number; c: number; h: number; a: number };

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_PATTERN = /^([a-z]+)\((.*)\)$/i;

const ACHROMATIC_CHROMA = 1e-4;
const HUE_LOW_CHROMA = 0.01;
const HUE_HIGH_CHROMA = 0.03;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

function parseNumber(value: string, context: string): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`Unsupported colour (${context}): invalid number "${value}"`);
  }

  return number;
}

function parseRgbChannel(value: string): number {
  const channel = value.endsWith("%")
    ? (parseNumber(value.slice(0, -1), value) * 255) / 100
    : parseNumber(value, value);

  return clamp(channel, 0, 255);
}

function parseAlpha(value: string): number {
  const alpha = value.endsWith("%")
    ? parseNumber(value.slice(0, -1), value) / 100
    : parseNumber(value, value);

  return clamp(alpha, 0, 1);
}

function parseOklchLightness(value: string): number {
  const lightness = value.endsWith("%")
    ? parseNumber(value.slice(0, -1), value) / 100
    : parseNumber(value, value);

  return clamp(lightness, 0, 1);
}

function parseOklchChroma(value: string): number {
  // CSS Color 4 maps 100% chroma to 0.4, the same as `oklch()` in browsers.
  const chroma = value.endsWith("%")
    ? (parseNumber(value.slice(0, -1), value) * 0.4) / 100
    : parseNumber(value, value);

  return Math.max(0, chroma);
}

function parseOklchHue(value: string): number {
  const degrees = value.endsWith("deg")
    ? parseNumber(value.slice(0, -3), value)
    : parseNumber(value, value);

  return normalizeHue(degrees);
}

function splitFunctionBody(body: string): { main: string[]; alpha: string } {
  if (body.includes(",")) {
    const parts = body.split(",").map((part) => part.trim());
    const alpha = parts.length === 4 ? parts.pop() : "1";

    if (parts.length !== 3) {
      throw new Error(`Unsupported colour: expected three channels in "${body}"`);
    }

    return { main: parts, alpha: alpha ?? "1" };
  }

  const [channels, alpha = "1"] = body.split("/").map((part) => part.trim());
  const main = channels.split(/\s+/).filter(Boolean);

  if (main.length !== 3) {
    throw new Error(`Unsupported colour: expected three channels in "${body}"`);
  }

  return { main, alpha };
}

function parseHex(hexDigits: string): Rgba {
  const digits = hexDigits.toLowerCase();

  if (digits.length === 3) {
    const [r, g, b] = digits.split("");

    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
      a: 1,
    };
  }

  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
    a: digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgbFunction(body: string): Rgba {
  const { main, alpha } = splitFunctionBody(body);

  return {
    r: parseRgbChannel(main[0]),
    g: parseRgbChannel(main[1]),
    b: parseRgbChannel(main[2]),
    a: parseAlpha(alpha),
  };
}

function parseOklchFunction(body: string): Rgba {
  const { main, alpha } = splitFunctionBody(body);

  return fromOklch({
    l: parseOklchLightness(main[0]),
    c: parseOklchChroma(main[1]),
    h: parseOklchHue(main[2]),
    a: parseAlpha(alpha),
  });
}

export function parseColor(css: string): Rgba {
  const input = css.trim();
  const hex = input.match(HEX_PATTERN);

  if (hex) return parseHex(hex[1]);

  const fn = input.match(FUNCTION_PATTERN);

  if (fn) {
    const name = fn[1].toLowerCase();

    if (name === "rgb" || name === "rgba") return parseRgbFunction(fn[2]);
    if (name === "oklch") return parseOklchFunction(fn[2]);
  }

  throw new Error(`Unsupported colour: "${css}"`);
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** Björn Ottosson's OKLab matrices, as specified by CSS Color 4. */
function oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function inSrgbGamut(l: number, c: number, h: number): boolean {
  const epsilon = 1e-6;

  return oklchToLinearSrgb(l, c, h).every(
    (channel) => channel >= -epsilon && channel <= 1 + epsilon,
  );
}

export function toOklch(c: Rgba): Oklch {
  const [l, a, b] = linearSrgbToOklab(
    srgbToLinear(c.r / 255),
    srgbToLinear(c.g / 255),
    srgbToLinear(c.b / 255),
  );

  return {
    l,
    c: Math.hypot(a, b),
    h: normalizeHue((Math.atan2(b, a) * 180) / Math.PI),
    a: c.a,
  };
}

export function fromOklch(o: Oklch): Rgba {
  const l = clamp(o.l, 0, 1);
  const h = normalizeHue(o.h);
  let c = Math.max(0, o.c);

  // Gamut clamp: keep l and h, reduce chroma until every linear channel fits
  // sRGB. Binary search because the gamut boundary has no closed form.
  if (!inSrgbGamut(l, c, h)) {
    let low = 0;
    let high = c;

    for (let i = 0; i < 32; i += 1) {
      const mid = (low + high) / 2;

      if (inSrgbGamut(l, mid, h)) low = mid;
      else high = mid;
    }

    c = low;
  }

  const [r, g, b] = oklchToLinearSrgb(l, c, h);

  return {
    r: clamp(linearToSrgb(r) * 255, 0, 255),
    g: clamp(linearToSrgb(g) * 255, 0, 255),
    b: clamp(linearToSrgb(b) * 255, 0, 255),
    a: clamp(o.a, 0, 1),
  };
}

export function blendOklch(a: Oklch, b: Oklch, t: number): Oklch {
  // A near-neutral side has no meaningful hue, so borrow the other side's
  // hue instead of sweeping through an arbitrary arc.
  const hueA = a.c < ACHROMATIC_CHROMA ? b.h : a.h;
  const hueB = b.c < ACHROMATIC_CHROMA ? a.h : b.h;
  const shortestArc = ((hueB - hueA + 540) % 360) - 180;

  return {
    l: a.l + (b.l - a.l) * t,
    c: a.c + (b.c - a.c) * t,
    h: normalizeHue(hueA + shortestArc * t),
    a: a.a + (b.a - a.a) * t,
  };
}

export function rotateHue(o: Oklch, deg: number): Oklch {
  // Below chroma 0.01 a colour reads as neutral and stays put; from 0.03 up it
  // rotates fully. Smoothstep between the two so tokens do not pop.
  const weight = smoothstep(HUE_LOW_CHROMA, HUE_HIGH_CHROMA, o.c);

  return { ...o, h: normalizeHue(o.h + deg * weight) };
}

function channelToHex(channel: number): string {
  return Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, "0");
}

export function toCss(c: Rgba): string {
  const r = channelToHex(c.r);
  const g = channelToHex(c.g);
  const b = channelToHex(c.b);

  if (c.a >= 1) return `#${r}${g}${b}`;

  return `rgba(${Math.round(clamp(c.r, 0, 255))}, ${Math.round(clamp(c.g, 0, 255))}, ${Math.round(clamp(c.b, 0, 255))}, ${c.a.toFixed(2)})`;
}

function relativeLuminance(c: Rgba): number {
  return (
    0.2126 * srgbToLinear(c.r / 255) +
    0.7152 * srgbToLinear(c.g / 255) +
    0.0722 * srgbToLinear(c.b / 255)
  );
}

export function contrastRatio(fg: Rgba, bg: Rgba): number {
  const alpha = clamp(fg.a, 0, 1);
  const composited =
    alpha < 1
      ? {
          r: fg.r * alpha + bg.r * (1 - alpha),
          g: fg.g * alpha + bg.g * (1 - alpha),
          b: fg.b * alpha + bg.b * (1 - alpha),
          a: 1,
        }
      : fg;

  const foreground = relativeLuminance(composited);
  const background = relativeLuminance(bg);
  const lighter = Math.max(foreground, background);
  const darker = Math.min(foreground, background);

  return (lighter + 0.05) / (darker + 0.05);
}
