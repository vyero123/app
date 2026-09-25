/**
 * tools/measure-contrast.mjs — is a piece legible over the influence map?
 *
 *   node tools/measure-contrast.mjs
 *
 * Shadows-on-plus-pieces-on is the state most likely to be illegible: a white
 * piece on a bright amber square and a black piece on a deep violet one are
 * light-on-light and dark-on-dark respectively. Rather than assume the
 * keylines save it, this measures.
 *
 * A piece is drawn as a fill with a keyline of the opposite value, so it is
 * legible if EITHER the fill or the keyline separates from the background.
 * We report the better of the two, and flag anything below 3:1 — the WCAG
 * threshold for a large graphical object.
 */

import { squareColour, tintFor } from '../js/colour.js';

const PIECE = {
  w: { fill: [255, 255, 255], key: [0x23, 0x18, 0x0a] },
  b: { fill: [0x0d, 0x0b, 0x08], key: [0xfb, 0xf7, 0xee] },
};

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const parse = (css) => css.match(/\d+/g).slice(0, 3).map(Number);

const CASES = [];
for (const n of [0, 1, 2, 3, 4, 5]) {
  if (n) CASES.push({ label: `White ×${n}`, w: n, b: 0 });
  if (n) CASES.push({ label: `Black ×${n}`, w: 0, b: n });
}
CASES.unshift({ label: 'no control', w: 0, b: 0 });
for (const [w, b] of [[1, 1], [2, 2], [3, 3], [4, 4], [4, 1], [1, 4]])
  CASES.push({ label: `contested ${w}–${b}`, w, b });

let worst = Infinity;
let worstCase = '';
const rows = [];

for (const c of CASES) {
  for (const light of [false, true]) {
    const bg = parse(squareColour(c.w, c.b, light));
    for (const side of ['w', 'b']) {
      const fill = ratio(PIECE[side].fill, bg);
      const key = ratio(PIECE[side].key, bg);
      const best = Math.max(fill, key);
      if (best < worst) { worst = best; worstCase = `${side === 'w' ? 'White' : 'Black'} on ${c.label} (${light ? 'light' : 'dark'} square)`; }
      rows.push({
        square: `${c.label}${light ? ' · light' : ''}`,
        side: side === 'w' ? 'White' : 'Black',
        fill: fill.toFixed(2),
        keyline: key.toFixed(2),
        best: best.toFixed(2),
        ok: best >= 3 ? 'ok' : 'LOW',
      });
    }
  }
}

const low = rows.filter((r) => r.ok === 'LOW');
console.log(`checked ${rows.length} piece/background combinations`);
console.log(`worst contrast: ${worst.toFixed(2)}:1 — ${worstCase}`);
console.log(`below 3:1 — ${low.length}`);
for (const r of low) console.log('  ', r);

// Show the interesting extremes in full.
console.log('\nthe two cases that were most likely to fail:');
for (const [label, w, b, side] of [['White ×5 amber', 5, 0, 'w'], ['contested 4–4 violet', 4, 4, 'b']]) {
  const bg = parse(squareColour(w, b, false));
  const t = tintFor(w, b);
  console.log(
    `  ${side === 'w' ? 'White' : 'Black'} piece on ${label} (hue ${t.hue.toFixed(0)}°): ` +
    `fill ${ratio(PIECE[side].fill, bg).toFixed(2)}:1, keyline ${ratio(PIECE[side].key, bg).toFixed(2)}:1`
  );
}

process.exit(low.length ? 1 : 0);
