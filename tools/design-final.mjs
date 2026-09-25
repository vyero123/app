/**
 * tools/design-final.mjs — the square chip against the O/X marks.
 *
 *   node tools/design-final.mjs
 *
 * Two candidates for shadow mode, both with option A's value-inverted pieces
 * in daylight (chips and marks are a shadow-mode device; daylight shows the
 * real pieces and needs no side token).
 *
 *   CHIP — a rounded square chip in the middle of the square, light for White
 *          with a dark keyline, dark for Black with a light one. Inset so the
 *          influence tint frames it.
 *   O/X  — no chip at all. White is an O, Black is an X, both in ONE ink, so
 *          the side is carried by shape alone and the tint reads straight
 *          through the gaps.
 *
 * Renders boards, an intensity ramp (the thing that has to survive), and the
 * stress squares — as SVG, then rasterised, so the page and the PNGs are the
 * same pixels.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../vendor/chess.js/chess.js';
import { computeInfluence, idxToSquare, fileOf, rankOf } from '../js/influence.js';
import { squareColour } from '../js/colour.js';
import { pieceSvg } from '../js/pieces.js';
import { GAMES } from '../games/games.js';
// Mark geometry lives in one module, shared with tools/measure-tint.mjs, so the
// comparison and the measurement can never describe different shapes.
import { chipMark, oxMark } from '../js/marks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SQ = 42, GAP = 1, BOARD = SQ * 8 + GAP * 7;
const EDGE_DARK = '#05070c', EDGE_DAY = '#8a6a4a';
const DAY_LIGHT = 'rgb(240,217,181)', DAY_DARK = 'rgb(181,136,99)';
const sx = (f) => f * (SQ + GAP);
const sy = (r) => (7 - r) * (SQ + GAP);
const rgb = (c) => c.replace(/ /g, ',');

/* ── marks ─────────────────────────────────────────────────────────────────
   Everything is drawn in a local 0..SQ box and translated into place.        */

const VARIANTS = {
  chip: {
    name: 'CHIP · rounded square, inset',
    line: 'White light with a dark keyline, Black dark with a light one. Inset 19%, and the occupancy ring is gone — the edge of the square is given back to the tint. King: its own cross, cut into the chip.',
    mark: chipMark,
  },
  ox: {
    name: 'O / X · shape instead of lightness',
    line: 'No chip. White is an O, Black an X, both in one ink with a dark keyline. The side is carried by shape alone, on a channel nothing else is using, and the tint reads straight through the gaps. King: four corner ticks.',
    mark: oxMark,
  },
};

/* ── boards ───────────────────────────────────────────────────────────────── */

function shapeBody(type) {
  return pieceSvg(type).replace(/^.*?<g /, '<g ').replace(/<\/svg>$/, '');
}
function dayPiece(f, r, p) {
  const inset = 0.05, size = SQ * (1 - 2 * inset), k = size / 100;
  const mark = p.color === 'w' ? '#23180a' : '#fbf7ee';
  const body = shapeBody(p.type)
    .replace(/class="eye"/g, `fill="${mark}" stroke="none"`)
    .replace(/class="cut"/g, `fill="none" stroke="${mark}" stroke-width="4.2"`);
  const paint = p.color === 'w'
    ? 'fill="#ffffff" stroke="#23180a" stroke-width="4"'
    : 'fill="#0d0b08" stroke="#fbf7ee" stroke-width="4"';
  return `<g paint-order="stroke" ${paint}><g transform="translate(${sx(f) + SQ * inset} ${sy(r) + SQ * inset}) scale(${k.toFixed(4)})">${body}</g></g>`;
}

function board(variant, mode, inf) {
  const dark = mode === 'shadow';
  let out = `<rect width="${BOARD}" height="${BOARD}" rx="7" fill="${dark ? EDGE_DARK : EDGE_DAY}"/>`;
  for (let i = 0; i < 64; i++) {
    const f = fileOf(i), r = rankOf(i), light = (f + r) % 2 === 1;
    const fill = dark ? squareColour(inf.w[i], inf.b[i], light) : light ? DAY_LIGHT : DAY_DARK;
    out += `<rect x="${sx(f)}" y="${sy(r)}" width="${SQ}" height="${SQ}" fill="${rgb(fill)}"/>`;
  }
  for (let i = 0; i < 64; i++) {
    const p = inf.cells[i];
    if (!p) continue;
    const f = fileOf(i), r = rankOf(i);
    if (dark) {
      out += `<g transform="translate(${sx(f)} ${sy(r)})">${VARIANTS[variant].mark(p.color, p.type === 'k')}</g>`;
    } else {
      out += dayPiece(f, r, p);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${out}</svg>`;
}

/* ── the intensity ramp ───────────────────────────────────────────────────
   The test the chip has to pass: with a mark sitting on the square, can you
   still tell White x1 from White x5, and read a contested square? Bases
   alternate light/dark across the row so both show up.                      */
const RAMP = [
  { l: 'none', w: 0, b: 0 },
  { l: 'W×1', w: 1, b: 0 },
  { l: 'W×3', w: 3, b: 0 },
  { l: 'W×5', w: 5, b: 0 },
  { l: 'B×5', w: 0, b: 5 },
  { l: '1–1', w: 1, b: 1 },
  { l: '2–2', w: 2, b: 2 },
  { l: '4–4', w: 4, b: 4 },
];

function rampRow(variant, side, king = false) {
  const w = RAMP.length * (SQ + 1) - 1;
  let out = '';
  RAMP.forEach((c, n) => {
    const x = n * (SQ + 1);
    out += `<g transform="translate(${x} 0)">`;
    out += `<rect width="${SQ}" height="${SQ}" fill="${rgb(squareColour(c.w, c.b, n % 2 === 1))}"/>`;
    out += VARIANTS[variant].mark(side, king);
    out += `</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${SQ}" viewBox="0 0 ${w} ${SQ}"><rect width="${w}" height="${SQ}" fill="${EDGE_DARK}"/>${out}</svg>`;
}

/** The same ramp with NO mark, as the reference: this is what full tint looks
    like, so you can see exactly how much each treatment costs you. */
function rampBare() {
  const w = RAMP.length * (SQ + 1) - 1;
  let out = '';
  RAMP.forEach((c, n) => {
    out += `<rect x="${n * (SQ + 1)}" width="${SQ}" height="${SQ}" fill="${rgb(squareColour(c.w, c.b, n % 2 === 1))}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${SQ}" viewBox="0 0 ${w} ${SQ}"><rect width="${w}" height="${SQ}" fill="${EDGE_DARK}"/>${out}</svg>`;
}

/* ── position ─────────────────────────────────────────────────────────────── */
function chosen() {
  const c = new Chess();
  c.loadPgn(GAMES.find((g) => g.id === 'immortal-1851').pgn);
  const h = c.history();
  const r = new Chess();
  for (let i = 0; i < 11; i++) r.move(h[i]); // after 6.Nf3 — the densest stress
  return computeInfluence(r.board());
}
const inf = chosen();

/* ── page + images ────────────────────────────────────────────────────────── */
const PAGE_W = 375, PAD = 16;
const innerOf = (s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const T = (x, y, s, size, weight, fill, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="Lato, DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const LABEL = (x, y, s) => T(x, y, s.toUpperCase(), 10, 700, '#6c7280');
function wrap(t, max) {
  const out = []; let line = '';
  for (const w of t.split(' ')) {
    if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; } else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

const RAMP_W = RAMP.length * (SQ + 1) - 1;
const rampLabels = (y) =>
  RAMP.map((c, n) => T(PAD + n * (SQ + 1) + SQ / 2, y, c.l, 9, 600, '#6c7280', 'middle')).join('');

function card(v) {
  let y = 22, out = '';
  out += T(PAD, y, VARIANTS[v].name, 16, 700, '#1b1d22');
  for (const ln of wrap(VARIANTS[v].line, 52)) { y += 15; out += T(PAD, y, ln, 12.5, 400, '#4a5059'); }
  y += 22;

  out += LABEL(PAD, y, 'Shadow mode'); y += 7;
  out += `<svg x="${PAD}" y="${y}" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${innerOf(board(v, 'shadow', inf))}</svg>`;
  y += BOARD + 20;

  out += LABEL(PAD, y, "Intensity ramp — White's mark"); y += 7;
  out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(rampRow(v, 'w'))}</svg>`;
  y += SQ + 12; out += rampLabels(y); y += 10;

  out += LABEL(PAD, y, "Intensity ramp — Black's mark"); y += 7;
  out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(rampRow(v, 'b'))}</svg>`;
  y += SQ + 12; out += rampLabels(y); y += 10;

  out += LABEL(PAD, y, 'The kings, on the same ramp'); y += 7;
  out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(rampRow(v, 'w', true))}</svg>`;
  y += SQ + 4;
  out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(rampRow(v, 'b', true))}</svg>`;
  y += SQ + 18;

  return { markup: out, height: y };
}

const cards = { chip: card('chip'), ox: card('ox') };

let y = 26, out = '';
out += T(PAD, y, 'Square chip, or O and X', 19, 700, '#1b1d22');
for (const ln of wrap(
  'Both use option A pieces in daylight — a side token is a shadow-mode device, and daylight already shows you the piece. Squares are 42px, the real size on a 375px phone. Position: the Immortal after 6.Nf3.',
  54
)) { y += 16; out += T(PAD, y, ln, 12.5, 400, '#4a5059'); }
y += 20;

out += LABEL(PAD, y, 'Reference — the tint with nothing on it'); y += 7;
out += `<svg x="${PAD}" y="${y}" width="${RAMP_W}" height="${SQ}" viewBox="0 0 ${RAMP_W} ${SQ}">${innerOf(rampBare())}</svg>`;
y += SQ + 12; out += rampLabels(y); y += 6;
for (const ln of wrap('This is the row every treatment below has to stay legible against. If you cannot tell W×1 from W×5 with a mark on it, the mark has cost too much.', 54)) {
  y += 15; out += T(PAD, y, ln, 12, 400, '#6c7280');
}
y += 16;

for (const k of ['chip', 'ox']) {
  out += `<line x1="${PAD}" y1="${y}" x2="${PAGE_W - PAD}" y2="${y}" stroke="#ddd8cc"/>`;
  out += `<g transform="translate(0 ${y})">${cards[k].markup}</g>`;
  y += cards[k].height;
}

out += `<line x1="${PAD}" y1="${y}" x2="${PAGE_W - PAD}" y2="${y}" stroke="#ddd8cc"/>`;
y += 24;
out += LABEL(PAD, y, 'Daylight — identical for both'); y += 7;
out += `<svg x="${PAD}" y="${y}" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${innerOf(board('chip', 'day', inf))}</svg>`;
y += BOARD + 20;

const H = y + 10;
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${H}" viewBox="0 0 ${PAGE_W} ${H}"><rect width="${PAGE_W}" height="${H}" fill="#f5f3ee"/>${out}</svg>`;

mkdirSync(join(root, 'design/img'), { recursive: true });
const { Resvg } = await import('@resvg/resvg-js');
const png = (svg, name, scale = 2) => {
  const buf = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(join(root, 'design/img', name), buf);
  return `${name} ${(buf.length / 1024).toFixed(0)}KB`;
};
console.log(png(sheet, 'chip-vs-ox-ALL.png'));
for (const k of ['chip', 'ox']) {
  const c = cards[k];
  console.log(png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${c.height + 10}" viewBox="0 0 ${PAGE_W} ${c.height + 10}"><rect width="${PAGE_W}" height="${c.height + 10}" fill="#f5f3ee"/>${c.markup}</svg>`,
    `chip-vs-ox-${k}.png`
  ));
}

writeFileSync(join(root, 'design/final.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shadow Chess — chip or O/X</title>
<style>:root{color-scheme:light}body{margin:0;background:#f5f3ee}img{display:block;width:100%;max-width:375px;margin:0 auto}</style>
</head><body><img src="img/chip-vs-ox-ALL.png" alt="Square chip compared with O and X marks"></body></html>`);
console.log('design/final.html');
