/**
 * tools/design-compare.mjs — the stacked A/B/C comparison.
 *
 *   node tools/design-compare.mjs
 *
 * Builds the boards as SVG rather than as DOM, for one reason: the same source
 * then produces both the web page (design/compare.html) and the PNGs that can
 * be sent to a phone directly, so what you see in the image is byte-identical
 * to what you see on the page. Rasterised with @resvg/resvg-js.
 *
 * Every board is the SAME position at the SAME influence state at the SAME
 * size. The only variable between the three is the piece/ring treatment. The
 * square is 42px, which is what a square actually measures on a 375px phone —
 * enlarging it would make the comparison useless, because all three options
 * look fine at 80px.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../vendor/chess.js/chess.js';
import { computeInfluence, idxToSquare, squareToIdx, fileOf, rankOf } from '../js/influence.js';
import { squareColour } from '../js/colour.js';
import { GAMES } from '../games/games.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── geometry ─────────────────────────────────────────────────────────────
   42px squares with a 1px grid, exactly as the app renders at 375px.        */
const SQ = 42;
const GAP = 1;
const BOARD = SQ * 8 + GAP * 7; // 343 — fits a 375px screen with 16px margins
const EDGE_DARK = '#05070c';
const EDGE_DAY = '#8a6a4a';
const DAY_LIGHT = 'rgb(240,217,181)';
const DAY_DARK = 'rgb(181,136,99)';

const sx = (f) => f * (SQ + GAP);
const sy = (r) => (7 - r) * (SQ + GAP);

/* ── the position ─────────────────────────────────────────────────────────
   The Immortal after 23.Be7#. Chosen because it contains every stress case
   in one board: a Black piece on a square nobody controls, White pieces on
   loud amber squares, and a spread of contested squares including the mated
   king's own square.                                                        */
function allStates() {
  const c = new Chess();
  c.loadPgn(GAMES.find((g) => g.id === 'immortal-1851').pgn);
  const moves = c.history();
  const replay = new Chess();
  const out = [{ ply: 0, san: null, inf: computeInfluence(replay.board()) }];
  moves.forEach((san, i) => {
    replay.move(san);
    out.push({ ply: i + 1, san, inf: computeInfluence(replay.board()) });
  });
  return out;
}

/**
 * Score a position by how well it exercises the three cases that separate the
 * options. A position only qualifies if it contains all three with a PIECE on
 * the square — an empty contested square shows nothing about a piece
 * treatment, and the first position I picked had a most-contested occupied
 * square of only 2-1, which is not a stress test of anything.
 */
function stressOf(inf) {
  let dead = null, amber = null, contested = null;
  for (let i = 0; i < 64; i++) {
    const p = inf.cells[i];
    if (!p) continue;
    const w = inf.w[i], b = inf.b[i];
    if (p.color === 'b' && w === 0 && b === 0 && !dead)
      dead = { idx: i, why: 'Black piece, nobody controls the square' };
    if (p.color === 'w' && b === 0 && w >= 3 && (!amber || w > inf.w[amber.idx]))
      amber = { idx: i, why: `White piece on White x${w} amber` };
    if (w > 0 && b > 0 && (!contested || w + b > inf.w[contested.idx] + inf.b[contested.idx]))
      contested = { idx: i, why: `Contested ${w}-${b}` };
  }
  if (!dead || !amber || !contested) return null;
  const cTot = inf.w[contested.idx] + inf.b[contested.idx];
  if (cTot < 5) return null; // not "heavily" contested
  return { picks: [dead, amber, contested], score: inf.w[amber.idx] * 2 + cTot * 3 };
}

/* ── piece shapes ──────────────────────────────────────────────────────────
   Pulled from js/pieces.js at build time so the comparison can never drift
   from the real set. We need the raw shape markup, not the wrapped <svg>.   */
import { pieceSvg } from '../js/pieces.js';
function shapeBody(type) {
  const svg = pieceSvg(type);
  return svg.replace(/^.*?<g /, '<g ').replace(/<\/svg>$/, '');
}

/**
 * Draw a piece inside the square at (f,r), inset by `inset` of the square.
 *
 * The eye and the mitre slit are cut INTO the silhouette, so they cannot
 * inherit the group's fill and stroke — they have to be painted explicitly in
 * the keyline colour. In the CSS build a stylesheet does this; here the
 * attributes are injected into the markup.
 *
 * `hollowEye` is for option B's White, where a filled dot would read as solid
 * on an otherwise open shape: it becomes a small ring instead.
 */
function piece(f, r, type, inset, mark, hollowEye = false) {
  const size = SQ * (1 - 2 * inset);
  const k = size / 100;
  const x = sx(f) + SQ * inset;
  const y = sy(r) + SQ * inset;
  const body = shapeBody(type)
    .replace(
      /class="eye"/g,
      hollowEye
        ? `fill="none" stroke="${mark}" stroke-width="3.5"`
        : `fill="${mark}" stroke="none"`
    )
    .replace(/class="cut"/g, `fill="none" stroke="${mark}" stroke-width="4.2"`);
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(4)})">${body}</g>`;
}

const rect = (f, r, inset, sw, stroke, rx) => {
  const o = inset + sw / 2;
  return `<rect x="${(sx(f) + o).toFixed(2)}" y="${(sy(r) + o).toFixed(2)}" width="${(SQ - 2 * o).toFixed(2)}" height="${(SQ - 2 * o).toFixed(2)}" rx="${rx}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
};
const disc = (f, r, inset, fill, stroke) => {
  const rr = SQ * (0.5 - inset);
  return `<circle cx="${(sx(f) + SQ / 2).toFixed(2)}" cy="${(sy(r) + SQ / 2).toFixed(2)}" r="${rr.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
};

/* ── the king's aura ───────────────────────────────────────────────────────
   An independent layer that sits under the ring and over the tint, so it
   works with whichever treatment is chosen. Rendered statically here, which
   is exactly what a reduced-motion browser sees. */
const AURA_DEFS = `<defs>
<radialGradient id="auraW" cx="50%" cy="50%" r="50%">
  <stop offset="0%" stop-color="#fff6e0" stop-opacity=".58"/>
  <stop offset="34%" stop-color="#ffe8aa" stop-opacity=".34"/>
  <stop offset="54%" stop-color="#ffd678" stop-opacity=".16"/>
  <stop offset="72%" stop-color="#ffd678" stop-opacity="0"/>
</radialGradient>
<radialGradient id="auraB" cx="50%" cy="50%" r="50%">
  <stop offset="0%" stop-color="#02060e" stop-opacity=".30"/>
  <stop offset="26%" stop-color="#02060e" stop-opacity=".24"/>
  <stop offset="50%" stop-color="#a8d2ff" stop-opacity=".42"/>
  <stop offset="63%" stop-color="#a8d2ff" stop-opacity=".16"/>
  <stop offset="78%" stop-color="#a8d2ff" stop-opacity="0"/>
</radialGradient>
</defs>`;

const aura = (f, r, side) => {
  const rr = SQ * 0.62; // inset -12%, i.e. it spills past the square
  return `<circle cx="${(sx(f) + SQ / 2).toFixed(2)}" cy="${(sy(r) + SQ / 2).toFixed(2)}" r="${rr.toFixed(2)}" fill="url(#aura${side === 'w' ? 'W' : 'B'})"/>`;
};

/* ── the three treatments ─────────────────────────────────────────────────
   Each supplies: how a piece is painted, and how the occupancy ring is drawn.
   Everything else about the board is identical.                             */
const OPTIONS = {
  a: {
    name: 'A · Value inversion with keylines',
    line: 'White is near-white with a dark keyline; Black near-black with a light one. Each piece carries both values at its edge. This is what ships today.',
    pieceInset: 0.05,
    paint: (side) =>
      side === 'w'
        ? 'fill="#ffffff" stroke="#23180a" stroke-width="4"'
        : 'fill="#0d0b08" stroke="#fbf7ee" stroke-width="4"',
    mark: (side) => (side === 'w' ? '#23180a' : '#fbf7ee'),
    ring: (f, r, side) =>
      side === 'w'
        ? rect(f, r, 2, 3.5, 'rgba(0,0,0,.6)', 3) + rect(f, r, 2, 2, '#ffffff', 4)
        : rect(f, r, 2, 3.5, 'rgba(255,255,255,.75)', 3) + rect(f, r, 2, 2, '#04060b', 4),
  },
  b: {
    name: 'B · Solid versus hollow',
    line: 'Both sides in the same ink. Black is filled, White is left open so the square shows through. The cue is topology, not colour.',
    pieceInset: 0.05,
    paint: (side, dark) => {
      const ink = dark ? '#f2ece0' : '#14110c';
      return side === 'b'
        ? `fill="${ink}" stroke="${ink}" stroke-width="5"`
        : `fill="none" stroke="${ink}" stroke-width="5"`;
    },
    mark: (side, dark) => (dark ? (side === 'b' ? '#14110c' : '#f2ece0') : side === 'b' ? '#f2ece0' : '#14110c'),
    ring: (f, r, side) =>
      side === 'b'
        ? rect(f, r, 2, 3, '#f2ece0', 4)
        : rect(f, r, 2, 1.5, '#f2ece0', 4) + rect(f, r, 6.5, 1.5, '#f2ece0', 3),
  },
  c: {
    name: 'C · Constant-contrast silhouette on a side chip',
    line: 'One ink for both armies, chosen for contrast against whatever is underneath; the side is carried by a chip behind the piece.',
    pieceInset: 0.11,
    chip: (f, r, side, inset) =>
      side === 'w'
        ? disc(f, r, inset, '#f6f1e4', '#6d5a3e')
        : disc(f, r, inset, '#55636e', '#cfd8de'),
    paint: (side) =>
      side === 'w'
        ? 'fill="#1a1712" stroke="#1a1712" stroke-width="3"'
        : 'fill="#0e1216" stroke="#0e1216" stroke-width="3"',
    mark: (side) => (side === 'w' ? '#efe8da' : '#cfd8de'),
    ring: () => '',
  },
};

/**
 * One board.
 * @param {'a'|'b'|'c'} id
 * @param {'shadow'|'day'} mode
 */
function board(id, mode, inf) {
  const o = OPTIONS[id];
  const dark = mode === 'shadow';
  let out = AURA_DEFS + `<rect width="${BOARD}" height="${BOARD}" rx="7" fill="${dark ? EDGE_DARK : EDGE_DAY}"/>`;

  for (let i = 0; i < 64; i++) {
    const f = fileOf(i);
    const r = rankOf(i);
    const isLight = (f + r) % 2 === 1;
    const fill = dark
      ? squareColour(inf.w[i], inf.b[i], isLight)
      : isLight ? DAY_LIGHT : DAY_DARK;
    out += `<rect x="${sx(f)}" y="${sy(r)}" width="${SQ}" height="${SQ}" fill="${fill.replace(/ /g, ',')}"/>`;
  }

  // Auras first, as their own pass: they spill past their square and must sit
  // under every ring on the board, not just their own.
  if (dark) {
    for (let i = 0; i < 64; i++) {
      const p = inf.cells[i];
      if (p && p.type === 'k') out += aura(fileOf(i), rankOf(i), p.color);
    }
  }

  for (let i = 0; i < 64; i++) {
    const p = inf.cells[i];
    if (!p) continue;
    const f = fileOf(i);
    const r = rankOf(i);
    if (dark) {
      // Shadow mode draws the ring only — the app does not show pieces here.
      if (id === 'c') out += o.chip(f, r, p.color, 0.15);
      else out += o.ring(f, r, p.color);
    } else {
      if (id === 'c') out += o.chip(f, r, p.color, 0.04);
      const hollow = id === 'b' && p.color === 'w';
      out += `<g paint-order="stroke" ${o.paint(p.color, false)}>${piece(f, r, p.type, o.pieceInset, o.mark(p.color, false), hollow)}</g>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${out}</svg>`;
}

/**
 * The three squares that separate the options, shown as isolated tiles:
 * once as the app draws them (ring over tint) and once with the silhouette,
 * which is the harsher test.
 */
function stressTiles(id, inf, picks) {
  const o = OPTIONS[id];
  const w = picks.length * (SQ + 10) - 10;
  let out = '';
  picks.forEach((pick, n) => {
    const i = pick.idx;
    const p = inf.cells[i];
    const isLight = (fileOf(i) + rankOf(i)) % 2 === 1;
    const bg = squareColour(inf.w[i], inf.b[i], isLight);
    const ox = n * (SQ + 10);
    // Re-render a single square by translating a one-square board.
    const f = 0, r = 7;
    let tile = `<rect x="0" y="0" width="${SQ}" height="${SQ}" fill="${bg.replace(/ /g, ',')}"/>`;
    if (id === 'c') tile += o.chip(f, r, p.color, 0.15);
    else tile += o.ring(f, r, p.color);
    let tile2 = `<rect x="0" y="0" width="${SQ}" height="${SQ}" fill="${bg.replace(/ /g, ',')}"/>`;
    if (id === 'c') tile2 += o.chip(f, r, p.color, 0.08);
    tile2 += `<g paint-order="stroke" ${o.paint(p.color, true)}>${piece(f, r, p.type, o.pieceInset, o.mark(p.color, true), id === 'b' && p.color === 'w')}</g>`;
    out +=
      `<g transform="translate(${ox} 0)">${tile}</g>` +
      `<g transform="translate(${ox} ${SQ + 8})">${tile2}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${SQ * 2 + 8}" viewBox="0 0 ${w} ${SQ * 2 + 8}">${out}</svg>`;
}

/* ── build ────────────────────────────────────────────────────────────────── */
const states = allStates();
let best = null;
for (const st of states) {
  const sc = stressOf(st.inf);
  if (sc && (!best || sc.score > best.score)) best = { ...sc, ...st };
}
if (!best) throw new Error('no position in the game exercises all three cases');
const inf = best.inf;
const picks = best.picks;
const moveLabel = best.ply === 0
  ? 'the starting position'
  : `move ${Math.floor((best.ply - 1) / 2) + 1}${best.ply % 2 ? '.' : '...'}${best.san}` +
    ` (ply ${best.ply} of ${states.length - 1})`;
console.log('chosen position:', moveLabel, '| stress:', picks.map(p => idxToSquare(p.idx) + ' ' + p.why).join(' | '));
const IDS = ['a', 'b', 'c'];

mkdirSync(join(root, 'design'), { recursive: true });
mkdirSync(join(root, 'design/img'), { recursive: true });

const assets = {};
for (const id of IDS) {
  assets[id] = {
    shadow: board(id, 'shadow', inf),
    day: board(id, 'day', inf),
    stress: stressTiles(id, inf, picks),
  };
}

const picksText = picks
  .map((p) => `<strong>${idxToSquare(p.idx)}</strong> — ${p.why}`)
  .join(' · ');

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shadow Chess — A / B / C, stacked</title>
<style>
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px 16px 48px; background: #f5f3ee; color: #1b1d22;
  font: 15px/1.55 ui-sans-serif, -apple-system, system-ui, sans-serif; }
.wrap { max-width: 343px; margin: 0 auto; }
h1 { font-size: 20px; margin: 0 0 6px; }
h2 { font-size: 17px; margin: 30px 0 2px; }
p { margin: 0 0 10px; }
.lede { color: #4a5059; font-size: 14px; }
.mode { font: 600 10px/1 ui-sans-serif; letter-spacing: .08em; text-transform: uppercase;
  color: #6c7280; margin: 12px 0 5px; }
svg { display: block; max-width: 100%; height: auto; border-radius: 7px; }
.stress svg { border-radius: 0; }
.cap { font-size: 12px; color: #6c7280; margin: 6px 0 0; }
.rec { background: #eef6ef; border-left: 3px solid #3f8f52; padding: 10px 13px;
  border-radius: 0 6px 6px 0; font-size: 14px; margin-top: 26px; }
hr { border: 0; border-top: 1px solid #ddd8cc; margin: 26px 0 0; }
</style></head><body><div class="wrap">

<h1>Three ways to tell the sides apart</h1>
<p class="lede">Same position, same influence state, same size — the only thing that changes
between the three is the piece treatment. Squares are 42px, which is what they actually
measure on a 375px phone. All three look fine at twice this size, which is why they are
not shown at twice this size.</p>
<p class="lede">The position is the Immortal Game at ${moveLabel} — chosen automatically as the position in the game that best exercises all three stress cases. Stress cases in it:
${picksText}.</p>

${IDS.map((id) => `
<hr>
<h2>${OPTIONS[id].name}</h2>
<p class="lede">${OPTIONS[id].line}</p>

<div class="mode">Shadow mode</div>
${assets[id].shadow}

<div class="mode">Daylight</div>
${assets[id].day}

<div class="mode stress">The three squares that decide it</div>
<div class="stress">${assets[id].stress}</div>
<p class="cap">${picks.map((p) => idxToSquare(p.idx)).join(' · ')}. Top row as the app draws
it — ring over the tint, no piece. Bottom row with the silhouette added, which the app does
not currently do, as the harsher test of the fill system.</p>
`).join('')}

<div class="rec">
<p style="margin-bottom:6px"><strong>The renders split the verdict, so here it is
straight.</strong> In <em>daylight</em> B is the strongest — hollow versus solid reads
instantly, and because both armies use one ink, legibility never depends on what is
underneath. In <em>shadow mode</em> C is the strongest, and by a wide margin: a filled cream
disc against a filled slate disc is read at a glance, where A's dark ring recedes into dark
tints and B's double hairline makes you count lines.</p>
<p style="margin-bottom:6px"><strong>My pick: B for the pieces, with C's filled disc for the
shadow-mode ring.</strong> That takes each option where it is strongest. It costs two things
worth knowing: White's army reads lighter in weight than Black's, and the disc masks the
middle of every occupied square, so on those 23 squares you judge the influence intensity
from the border rather than the whole tile.</p>
<p style="margin:0"><strong>If you want one option unmixed, take B.</strong> A is the
conventional answer but it is also the one you said was too weak, so recommending it back to
you would be no answer at all. C unmixed makes every piece look the same and turns the board
into a field of discs — it identifies the side well and shows the piece badly. Nothing is
shipped; say which and I will build it.</p>
</div>

</div></body></html>`;

writeFileSync(join(root, 'design/compare.html'), page);
console.log(`design/compare.html  ${(page.length / 1024).toFixed(0)} KB`);

/* PNGs, for sending straight to a phone. 2× so they stay crisp, but the
   layout is the 375px one — this is a retina render of a phone-sized board,
   not a bigger board. */
const { Resvg } = await import('@resvg/resvg-js');
const png = (svg, name, scale = 2) => {
  const r = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: true } });
  const buf = r.render().asPng();
  writeFileSync(join(root, 'design/img', name), buf);
  return `${name} ${(buf.length / 1024).toFixed(0)}KB`;
};
const made = [];
for (const id of IDS) {
  made.push(png(assets[id].shadow, `${id}-shadow.png`));
  made.push(png(assets[id].day, `${id}-daylight.png`));
  made.push(png(assets[id].stress, `${id}-stress.png`, 3));
}
console.log(made.join('\n'));

/* ── composite cards ───────────────────────────────────────────────────────
   One PNG per option, 375px wide — the phone's own width — with the two
   boards and the stress row stacked and labelled, so the whole comparison can
   be sent as images without opening a page. Plus one tall PNG with all three
   for straight A-against-B-against-C reading.                               */

const PAGE_W = 375;
const PAD = 16;
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

function wrap(text, max) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

const T = (x, y, s, size, weight, fill, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="Lato, DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;

const LABEL = (x, y, s) => T(x, y, s.toUpperCase(), 10, 700, '#6c7280');

function card(id) {
  const o = OPTIONS[id];
  let y = 0;
  let out = '';
  y += 22;
  out += T(PAD, y, o.name, 17, 700, '#1b1d22');
  y += 8;
  for (const ln of wrap(o.line, 52)) { y += 15; out += T(PAD, y, ln, 12.5, 400, '#4a5059'); }
  y += 20;
  out += LABEL(PAD, y, 'Shadow mode');
  y += 7;
  out += `<svg x="${PAD}" y="${y}" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${inner(assets[id].shadow)}</svg>`;
  y += BOARD + 20;
  out += LABEL(PAD, y, 'Daylight');
  y += 7;
  out += `<svg x="${PAD}" y="${y}" width="${BOARD}" height="${BOARD}" viewBox="0 0 ${BOARD} ${BOARD}">${inner(assets[id].day)}</svg>`;
  y += BOARD + 20;
  out += LABEL(PAD, y, 'The three squares that decide it');
  y += 7;
  const sw = picks.length * (SQ + 10) - 10;
  const sh = SQ * 2 + 8;
  out += `<svg x="${PAD}" y="${y}" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}">${inner(assets[id].stress)}</svg>`;
  picks.forEach((p, n) => {
    out += T(PAD + n * (SQ + 10) + SQ / 2, y + sh + 12, idxToSquare(p.idx), 10, 700, '#4a5059', 'middle');
  });
  y += sh + 22;
  return { markup: out, height: y + 10 };
}

const cards = IDS.map((id) => ({ id, ...card(id) }));

for (const c of cards) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${c.height}" viewBox="0 0 ${PAGE_W} ${c.height}"><rect width="${PAGE_W}" height="${c.height}" fill="#f5f3ee"/>${c.markup}</svg>`;
  console.log(png(svg, `compare-${c.id.toUpperCase()}.png`, 2));
}

{
  let y = 0;
  let out = '';
  y += 26;
  out += T(PAD, y, 'Three ways to tell the sides apart', 19, 700, '#1b1d22');
  for (const ln of wrap(
    `Same position, same influence state, same size. Squares are 42px — what they measure on a 375px phone. Position: the Immortal Game at ${moveLabel.replace(/ \(ply.*/, '')}, chosen as the position that best exercises all three stress cases.`,
    54
  )) { y += 16; out += T(PAD, y, ln, 12.5, 400, '#4a5059'); }
  y += 8;
  for (const c of cards) {
    out += `<g transform="translate(0 ${y})">${c.markup}</g>`;
    y += c.height;
    out += `<line x1="${PAD}" y1="${y - 4}" x2="${PAGE_W - PAD}" y2="${y - 4}" stroke="#ddd8cc"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${y + 10}" viewBox="0 0 ${PAGE_W} ${y + 10}"><rect width="${PAGE_W}" height="${y + 10}" fill="#f5f3ee"/>${out}</svg>`;
  console.log(png(svg, 'compare-ALL.png', 2));
}
