/**
 * colour.js — turning (whiteCount, blackCount) into one square colour.
 *
 * The important decision here: a contested square is NOT produced by
 * alpha-compositing a white layer over a black layer. Doing that gives you a
 * muddy, order-dependent colour that drifts toward grey exactly where the
 * board is most interesting. Instead every square gets ONE colour, looked up
 * deterministically from the pair of counts, so a contested square is a
 * deliberate third hue rather than an accident of blending.
 *
 * Hues:
 *   White side  — amber  (~38°)
 *   Black side  — cyan   (~190°)
 *   Contested   — violet (~288°), nudged ±26° toward whichever side has more
 *                 attackers, so you can read the balance as well as the fact
 *                 of contention.
 *   Isolated    — chartreuse (~78°), used only for the single-piece spotlight
 *                 so it can never be confused with either side's influence.
 *
 * Intensity is a DISCRETE five-step ramp, not a continuous function. Discrete
 * steps are what make "two attackers" distinguishable from "three" at a
 * glance; a smooth ramp reads as one smear.
 */

export const HUE_WHITE = 38;
export const HUE_BLACK = 190;
export const HUE_CONTESTED = 288;
export const HUE_ISOLATE = 78;

/** Board base colours (the board itself is nearly monochrome so tint dominates). */
export const SQUARE_LIGHT = [30, 36, 52];
export const SQUARE_DARK = [20, 24, 38];

/** Discrete intensity ramp, indexed by attacker count (clamped to 5). */
const ALPHA = [0, 0.26, 0.43, 0.57, 0.69, 0.8];
/** Lightness lift per extra attacker — keeps deep squares from going muddy. */
const LIGHT_LIFT = [0, 0, 2, 4, 6, 8];

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export const rgbCss = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

/**
 * The tint for a square, given how many pieces of each side control it.
 * Returns null when nobody controls it.
 *
 *   { hue, count, alpha, rgb }
 */
export function tintFor(w, b) {
  if (w === 0 && b === 0) return null;

  let hue;
  let count;
  if (b === 0) {
    hue = HUE_WHITE;
    count = w;
  } else if (w === 0) {
    hue = HUE_BLACK;
    count = b;
  } else {
    // Contested. Lean the violet toward whichever side has the upper hand.
    const dominance = (w - b) / (w + b); // -1 (black) .. +1 (white)
    hue = HUE_CONTESTED + dominance * 26;
    count = w + b;
  }

  const step = Math.min(count, 5);
  const alpha = ALPHA[step];
  // Contested squares get a touch more saturation so violet stays violet.
  const sat = w > 0 && b > 0 ? 80 : 92;
  const light = 54 + LIGHT_LIFT[step];
  return { hue, count, alpha, rgb: hslToRgb(hue, sat, light) };
}

/** Final painted colour of a square: tint composited onto the board base. */
export function squareColour(w, b, isLightSquare) {
  const base = isLightSquare ? SQUARE_LIGHT : SQUARE_DARK;
  const tint = tintFor(w, b);
  if (!tint) return rgbCss(base);
  return rgbCss(mix(base, tint.rgb, tint.alpha));
}

/** Spotlight colour for the isolate mode (one piece's own shadow). */
export function isolateColour(isLightSquare, count = 1) {
  const base = isLightSquare ? SQUARE_LIGHT : SQUARE_DARK;
  const step = Math.min(Math.max(count, 1), 5);
  return rgbCss(mix(base, hslToRgb(HUE_ISOLATE, 88, 58), ALPHA[step] + 0.08));
}

/** Dimmed base for squares outside the spotlight. */
export function dimmedColour(w, b, isLightSquare) {
  const base = isLightSquare ? SQUARE_LIGHT : SQUARE_DARK;
  const tint = tintFor(w, b);
  if (!tint) return rgbCss(base);
  return rgbCss(mix(base, tint.rgb, tint.alpha * 0.22));
}

/** Swatches for the legend. */
export function legendSwatches() {
  const rows = [];
  for (const [label, w, b] of [
    ['White ×1', 1, 0],
    ['White ×2', 2, 0],
    ['White ×3', 3, 0],
    ['White ×4+', 4, 0],
  ]) rows.push({ label, colour: squareColour(w, b, false) });
  for (const [label, w, b] of [
    ['Black ×1', 0, 1],
    ['Black ×2', 0, 2],
    ['Black ×3', 0, 3],
    ['Black ×4+', 0, 4],
  ]) rows.push({ label, colour: squareColour(w, b, false) });
  for (const [label, w, b] of [
    ['Contested', 1, 1],
    ['Contested, White ahead', 3, 1],
    ['Contested, Black ahead', 1, 3],
    ['Heavily contested', 4, 4],
  ]) rows.push({ label, colour: squareColour(w, b, false) });
  return rows;
}
