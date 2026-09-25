/**
 * tools/design-states.mjs — the four states, rendered.
 *
 *   node tools/design-states.mjs
 *
 * Shadow and Chess are independent layers, so there are four combinations.
 * Each is drawn here at real board size with the wordmark above it showing
 * the state it is in, plus an intensity ramp underneath so the two states
 * that paint tints can be checked across the whole range.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../vendor/chess.js/chess.js';
import { computeInfluence, fileOf, rankOf } from '../js/influence.js';
import { squareColour } from '../js/colour.js';
import { pieceSvg } from '../js/pieces.js';
import { oxMark } from '../js/marks.js';
import { GAMES } from '../games/games.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQ = 42, GAP = 1, BOARD = SQ * 8 + GAP * 7;
const sx = (f) => f * (SQ + GAP);
const sy = (r) => (7 - r) * (SQ + GAP);
const rgbf = (c) => c.replace(/ /g, ',');
const DAY_LIGHT = 'rgb(240,217,181)', DAY_DARK = 'rgb(181,136,99)';

function shapeBody(type) {
  return pieceSvg(type).replace(/^.*?<g /, '<g ').replace(/<\/svg>$/, '');
}
function piece(f, r, p) {
  const inset = 0.05, k = (SQ * (1 - 2 * inset)) / 100;
  const key = p.color === 'w' ? '#23180a' : '#fbf7ee';
  const body = shapeBody(p.type)
    .replace(/class="eye"/g, `fill="${key}" stroke="none"`)
    .replace(/class="cut"/g, `fill="none" stroke="${key}" stroke-width="4.2"`);
  const paint = p.color === 'w'
    ? 'fill="#ffffff" stroke="#23180a" stroke-width="4"'
    : 'fill="#0d0b08" stroke="#fbf7ee" stroke-width="4"';
  return `<g paint-order="stroke" ${paint}><g transform="translate(${sx(f) + SQ * inset} ${sy(r) + SQ * inset}) scale(${k.toFixed(4)})">${body}</g></g>`;
}

function board(inf, shadows, pieces) {
  let out = `<rect width="${BOARD}" height="${BOARD}" rx="7" fill="${shadows ? '#05070c' : '#8a6a4a'}"/>`;
  for (let i = 0; i < 64; i++) {
    const f = fileOf(i), r = rankOf(i), light = (f + r) % 2 === 1;
    const fill = shadows ? squareColour(inf.w[i], inf.b[i], light) : light ? DAY_LIGHT : DAY_DARK;
    out += `<rect x="${sx(f)}" y="${sy(r)}" width="${SQ}" height="${SQ}" fill="${rgbf(fill)}"/>`;
  }
  for (let i = 0; i < 64; i++) {
    const p = inf.cells[i];
    if (!p) continue;
    const f = fileOf(i), r = rankOf(i);
    // With the pieces on, the marks come off — two identity systems on one
    // square is noise.
    if (pieces) out += piece(f, r, p);
    else if (shadows) out += `<g transform="translate(${sx(f)} ${sy(r)})">${oxMark(p.color, p.type === 'k')}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${out}</svg>`;
}

const RAMP = [
  { l: 'none', w: 0, b: 0 }, { l: 'W×1', w: 1, b: 0 }, { l: 'W×3', w: 3, b: 0 },
  { l: 'W×5', w: 5, b: 0 }, { l: 'B×5', w: 0, b: 5 }, { l: '1–1', w: 1, b: 1 },
  { l: '2–2', w: 2, b: 2 }, { l: '4–4', w: 4, b: 4 },
];
const RAMP_W = RAMP.length * (SQ + 1) - 1;

/** The ramp with whatever the state puts on a square, for both sides. */
function ramp(shadows, pieces, side) {
  let out = `<rect width="${RAMP_W}" height="${SQ}" fill="#05070c"/>`;
  RAMP.forEach((c, n) => {
    const x = n * (SQ + 1), light = n % 2 === 1;
    const fill = shadows ? squareColour(c.w, c.b, light) : light ? DAY_LIGHT : DAY_DARK;
    out += `<rect x="${x}" width="${SQ}" height="${SQ}" fill="${rgbf(fill)}"/>`;
    const p = { color: side, type: side === 'w' ? 'r' : 'n' };
    if (pieces) {
      const inset = 0.05, k = (SQ * (1 - 2 * inset)) / 100;
      const key = side === 'w' ? '#23180a' : '#fbf7ee';
      const body = shapeBody(p.type)
        .replace(/class="eye"/g, `fill="${key}" stroke="none"`)
        .replace(/class="cut"/g, `fill="none" stroke="${key}" stroke-width="4.2"`);
      const paint = side === 'w'
        ? 'fill="#ffffff" stroke="#23180a" stroke-width="4"'
        : 'fill="#0d0b08" stroke="#fbf7ee" stroke-width="4"';
      out += `<g paint-order="stroke" ${paint}><g transform="translate(${x + SQ * inset} ${SQ * inset}) scale(${k.toFixed(4)})">${body}</g></g>`;
    } else if (shadows) {
      out += `<g transform="translate(${x} 0)">${oxMark(side, false)}</g>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${out}</svg>`;
}

function position() {
  const c = new Chess();
  c.loadPgn(GAMES.find((g) => g.id === 'immortal-1851').pgn);
  const h = c.history();
  const r = new Chess();
  for (let i = 0; i < 11; i++) r.move(h[i]);
  return computeInfluence(r.board());
}
const inf = position();

const STATES = [
  { s: true, p: false, t: 'Shadow on · Chess off', d: 'The influence map alone. O for White, X for Black; corner ticks on the kings.' },
  { s: true, p: true, t: 'Shadow on · Chess on', d: 'The hybrid — the position with its shadows under it. Marks drop; the pieces say it instead.' },
  { s: false, p: true, t: 'Shadow off · Chess on', d: 'An ordinary chessboard.' },
  { s: false, p: false, t: 'Shadow off · Chess off', d: 'A bare board. Allowed, not blocked.' },
];

const PAGE_W = 375, PAD = 16;
const innerOf = (x) => x.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const T = (x, y, s, size, weight, fill, anchor = 'start', extra = '') =>
  `<text x="${x}" y="${y}" font-family="Lato, DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
function wrap(t, max) {
  const o = []; let l = '';
  for (const w of t.split(' ')) { if ((l + ' ' + w).trim().length > max) { o.push(l.trim()); l = w; } else l += ' ' + w; }
  if (l.trim()) o.push(l.trim());
  return o;
}

/** The wordmark as the app draws it, with each half showing its own state. */
function wordmark(x, y, shadows, pieces) {
  const SH = shadows ? '#e8ecf5' : 'rgba(232,236,245,.42)';
  const CH = pieces ? '#f0a81e' : 'rgba(240,168,30,.42)';
  let out = T(x, y, 'Shadow', 20, shadows ? 700 : 400, SH);
  out += T(x + 66, y, 'Chess', 20, pieces ? 700 : 400, CH);
  // underline: solid when on, dotted when off
  const u = (x0, w, on, col) =>
    `<line x1="${x0}" y1="${y + 5}" x2="${x0 + w}" y2="${y + 5}" stroke="${col}" stroke-width="${on ? 2 : 1.4}" ${on ? '' : 'stroke-dasharray="1.5 2.5"'} stroke-linecap="round"/>`;
  out += u(x, 62, shadows, SH) + u(x + 66, 50, pieces, CH);
  return out;
}

let y = 26, out = '';
out += T(PAD, y, 'The wordmark is the control', 19, 700, '#1b1d22');
for (const ln of wrap('Each half toggles its own layer, and shows its own state — bold with a solid underline when on, dimmed and dotted when off. Four states, all of them working. Squares are 42px, the real size on a 375px phone.', 54)) {
  y += 16; out += T(PAD, y, ln, 12.5, 400, '#4a5059');
}
y += 10;

for (const st of STATES) {
  y += 14;
  out += `<line x1="${PAD}" y1="${y}" x2="${PAGE_W - PAD}" y2="${y}" stroke="#ddd8cc"/>`;
  y += 22;
  // Draw the wordmark on its own dark/light chip so it reads as the app's header.
  out += `<rect x="${PAD}" y="${y - 17}" width="${BOARD}" height="30" rx="6" fill="${st.s ? '#0a0c12' : '#2a2620'}"/>`;
  out += wordmark(PAD + 10, y + 3, st.s, st.p);
  y += 26;
  out += T(PAD, y, st.t, 13, 700, '#1b1d22');
  for (const ln of wrap(st.d, 56)) { y += 14; out += T(PAD, y, ln, 12, 400, '#4a5059'); }
  y += 12;
  out += `<svg x="${PAD}" y="${y}" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${innerOf(board(inf, st.s, st.p))}</svg>`;
  y += BOARD + 16;
  if (st.s) {
    out += T(PAD, y, 'ACROSS THE INTENSITY RANGE', 10, 700, '#6c7280');
    y += 7;
    out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(ramp(st.s, st.p, 'w'))}</svg>`;
    y += SQ + 3;
    out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(ramp(st.s, st.p, 'b'))}</svg>`;
    y += SQ + 12;
    out += RAMP.map((c, n) => T(PAD + n * (SQ + 1) + SQ / 2, y, c.l, 9, 600, '#6c7280', 'middle')).join('');
    y += 8;
  }
}

const H = y + 16;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${H}" viewBox="0 0 ${PAGE_W} ${H}"><rect width="${PAGE_W}" height="${H}" fill="#f5f3ee"/>${out}</svg>`;

mkdirSync(join(root, 'design/img'), { recursive: true });
const { Resvg } = await import('@resvg/resvg-js');
const buf = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: true } }).render().asPng();
writeFileSync(join(root, 'design/img/four-states.png'), buf);
console.log(`design/img/four-states.png ${(buf.length / 1024).toFixed(0)}KB`);

writeFileSync(join(root, 'design/states.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shadow Chess — the four states</title>
<style>:root{color-scheme:light}body{margin:0;background:#f5f3ee}img{display:block;width:100%;max-width:375px;margin:0 auto}</style>
</head><body><img src="img/four-states.png" alt="The four states of the Shadow and Chess toggles"></body></html>`);
