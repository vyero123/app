/**
 * tools/design-sheet.mjs — builds design/piece-options.html.
 *
 * A comparison sheet for three ways of distinguishing White's pieces from
 * Black's. Not part of the app; it imports the real colour model and the real
 * piece shapes so the backdrops and silhouettes shown are the actual ones,
 * not an approximation drawn for the mockup.
 *
 *   node tools/design-sheet.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { squareColour, tintFor } from '../js/colour.js';
import { pieceSvg } from '../js/pieces.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const DAY_LIGHT = 'rgb(240 217 181)';
const DAY_DARK = 'rgb(181 136 99)';

/* The shadow-mode backdrops that actually matter — the easy case, the two
   loudest single-sided squares, and the contested squares where these
   treatments usually fall over. Colours come from the real model. */
const SHADOW_CASES = [
  { label: 'no control', w: 0, b: 0 },
  { label: 'White ×1', w: 1, b: 0 },
  { label: 'White ×5', w: 5, b: 0 },
  { label: 'Black ×5', w: 0, b: 5 },
  { label: 'contested 1–1', w: 1, b: 1 },
  { label: 'contested 4–4', w: 4, b: 4 },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Option C carries the side on a chip behind the piece; the others do not. */
const chip = (opt) => (opt === 'c' ? '<span class="chip"></span>' : '');

function daylightRow(opt) {
  let out = '';
  TYPES.forEach((t, i) => {
    out += `<div class="sq" data-opt="${opt}" data-side="w" style="background:${i % 2 ? DAY_DARK : DAY_LIGHT}" title="White ${NAMES[t]}">${chip(opt)}<span class="piece">${pieceSvg(t)}</span></div>`;
  });
  TYPES.forEach((t, i) => {
    out += `<div class="sq" data-opt="${opt}" data-side="b" style="background:${i % 2 ? DAY_LIGHT : DAY_DARK}" title="Black ${NAMES[t]}">${chip(opt)}<span class="piece">${pieceSvg(t)}</span></div>`;
  });
  return out;
}

/** Shadow mode draws no pieces — only the occupancy ring over the tint. */
function shadowRow(opt) {
  let out = '';
  for (const side of ['w', 'b']) {
    for (const c of SHADOW_CASES) {
      const bg = squareColour(c.w, c.b, false);
      out +=
        `<div class="sq ring" data-opt="${opt}" data-side="${side}" style="background:${bg}" title="${side === 'w' ? 'White' : 'Black'} piece on ${c.label}">` +
        `${chip(opt)}<span class="glow"></span></div>`;
    }
  }
  return out;
}

/** Same, but with the piece drawn too — what it would look like if we ever
    showed silhouettes over the influence map. Stress-tests the worst case. */
function shadowPieceRow(opt) {
  let out = '';
  for (const side of ['w', 'b']) {
    for (const c of SHADOW_CASES) {
      const bg = squareColour(c.w, c.b, false);
      const t = side === 'w' ? 'r' : 'n';
      out +=
        `<div class="sq ring" data-opt="${opt}" data-side="${side}" style="background:${bg}">` +
        `${chip(opt)}<span class="glow"></span><span class="piece">${pieceSvg(t)}</span></div>`;
    }
  }
  return out;
}

const CASE_LABELS = SHADOW_CASES.map((c) => c.label);

const OPTIONS = [
  {
    id: 'a',
    name: 'A · Value inversion with keylines',
    blurb: `White is near-white with a dark keyline; Black is near-black with a light
      keyline. Every piece therefore carries <em>both</em> values at its edge, so whichever
      way the backdrop goes, one of the two still reads. This is what chess sets have done
      for two hundred years, and it is what the app ships today — shown here tightened, with
      a wider value gap and a heavier keyline.`,
    trades: `Relies entirely on lightness. On a mid-lightness backdrop — amber ×3, contested
      ×2 — both sides sit at similar local contrast and you tell them apart by which value is
      on the <em>inside</em>, which is a second-order read. The keyline also eats into the
      silhouette: at 40px it is about 1.4 CSS px, which rounds off the knight's muzzle and
      the queen's points.`,
  },
  {
    id: 'b',
    name: 'B · Solid versus hollow',
    blurb: `Both sides are drawn in the <em>same</em> ink. Black is a filled silhouette;
      White is the same silhouette left open, so the square shows through its body. The
      distinction stops being a colour and becomes a topology — filled or hollow — which
      survives any backdrop and any colour vision. In shadow mode the ring follows the same
      logic: Black gets a solid ring, White a double hairline.`,
    trades: `Hollow pieces read lighter in weight, so White's army can feel less present than
      Black's — a real perceptual asymmetry, not just a stylistic one. The open body means
      the influence tint reads straight through White's pieces, which is either the point of
      this app or a distraction depending on your taste. Outline-only shapes need a generous
      stroke at 40px or they go lacy, which limits how fine the internal detail can get.`,
  },
  {
    id: 'c',
    name: 'C · Constant-contrast silhouette on a side chip',
    blurb: `The side is moved <em>off</em> the silhouette. Both armies are drawn in one ink
      chosen purely for contrast against the backdrop, so the shapes are equally legible
      everywhere; which side it belongs to is carried by a chip sitting behind the piece —
      bright for White, dark for Black. In shadow mode the chip <em>is</em> the occupancy
      ring, so two signals collapse into one instead of competing.`,
    trades: `Adds a second element inside a 40px square, and that element is the same kind of
      thing as the ring — a shape around the piece — so it is the option most at risk of
      looking busy. The chip also masks part of the influence tint under every occupied
      square, which costs information on exactly the squares you most want to read. In
      exchange it is the only option where piece legibility is <em>independent</em> of the
      backdrop.`,
  },
];

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 20px 16px 60px;
  background: #f5f3ee; color: #1b1d22;
  font: 15px/1.6 ui-sans-serif, -apple-system, system-ui, sans-serif;
}
.wrap { max-width: 760px; margin: 0 auto; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 34px 0 2px; }
h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em;
     color: #6c7280; margin: 18px 0 6px; font-weight: 600; }
p { margin: 0 0 10px; }
.lede { color: #4a5059; }
.trade { color: #7a4a12; background: #fdf6e8; border-left: 3px solid #d9a441;
         padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 14px; }
.note { font-size: 13px; color: #6c7280; }
.rec { background: #eef6ef; border-left: 3px solid #3f8f52; padding: 10px 14px;
       border-radius: 0 6px 6px 0; }

/* Squares are 42px — the real size on a 375px phone. Resist the urge to
   enlarge them: everything looks fine at 80px. */
.strip { display: grid; grid-template-columns: repeat(12, 42px); width: 504px;
         max-width: 100%; border-radius: 6px; overflow: hidden; }
.strip.dark { background: #05070c; gap: 1px; }
.sq { width: 42px; height: 42px; position: relative; }
.labels { display: grid; grid-template-columns: repeat(12, 42px); width: 504px;
          font: 9px/1.3 ui-monospace, Menlo, monospace; color: #7c828c;
          margin-top: 3px; }
.labels span { text-align: center; padding: 0 1px; overflow: hidden; }
.side { font: 600 11px/1 ui-sans-serif; color: #6c7280; margin: 10px 0 4px; }

.piece { position: absolute; inset: 5%; display: block; }
.piece svg { width: 100%; height: 100%; display: block; overflow: visible; }
.piece svg > g { stroke-linejoin: round; stroke-linecap: round; paint-order: stroke fill; }
.piece .cut { fill: none; stroke-linecap: round; }
.glow { position: absolute; inset: 2px; border-radius: 4px; pointer-events: none; }

/* ---- Option A: value inversion ---- */
[data-opt="a"] .piece svg > g { stroke-width: 4; }
[data-opt="a"][data-side="w"] .piece svg > g { fill: #ffffff; stroke: #23180a; }
[data-opt="a"][data-side="b"] .piece svg > g { fill: #0d0b08; stroke: #fbf7ee; }
[data-opt="a"][data-side="w"] .piece .eye,
[data-opt="a"][data-side="w"] .piece .cut { stroke: #23180a; fill: none; stroke-width: 4.2; }
[data-opt="a"][data-side="b"] .piece .eye,
[data-opt="a"][data-side="b"] .piece .cut { stroke: #fbf7ee; fill: none; stroke-width: 4.2; }
[data-opt="a"][data-side="w"] .piece circle.eye { fill: #23180a; stroke: none; }
[data-opt="a"][data-side="b"] .piece circle.eye { fill: #fbf7ee; stroke: none; }
[data-opt="a"][data-side="w"] .glow {
  box-shadow: inset 0 0 0 2px #fff, inset 0 0 0 3.5px rgba(0,0,0,.6), 0 0 8px rgba(255,255,255,.22); }
[data-opt="a"][data-side="b"] .glow {
  box-shadow: inset 0 0 0 2px #04060b, inset 0 0 0 3.5px rgba(255,255,255,.75), 0 0 8px rgba(0,0,0,.4); }

/* ---- Option B: solid vs hollow, one ink ---- */
[data-opt="b"] .piece svg > g { stroke-width: 5; }
[data-opt="b"][data-side="b"] .piece svg > g { fill: #14110c; stroke: #14110c; }
[data-opt="b"][data-side="w"] .piece svg > g { fill: none; stroke: #14110c; }
[data-opt="b"] .piece .cut { stroke: #14110c; stroke-width: 4.2; }
[data-opt="b"][data-side="b"] .piece circle.eye { fill: #f5efe2; stroke: none; }
[data-opt="b"][data-side="w"] .piece circle.eye { fill: none; stroke: #14110c; stroke-width: 3.5; }
/* Over the dark influence map the single ink flips to light — it is one ink
   per context, not one ink forever. */
.strip.dark [data-opt="b"] .piece svg > g { stroke: #f2ece0; }
.strip.dark [data-opt="b"][data-side="b"] .piece svg > g { fill: #f2ece0; }
.strip.dark [data-opt="b"][data-side="b"] .piece circle.eye { fill: #14110c; }
.strip.dark [data-opt="b"][data-side="w"] .piece circle.eye { stroke: #f2ece0; }
.strip.dark [data-opt="b"] .piece .cut { stroke: #f2ece0; }
[data-opt="b"][data-side="b"] .glow {
  box-shadow: inset 0 0 0 3px #f2ece0, 0 0 8px rgba(0,0,0,.35); }
[data-opt="b"][data-side="w"] .glow {
  box-shadow: inset 0 0 0 1.5px #f2ece0, inset 0 0 0 4.5px transparent,
              inset 0 0 0 6px #f2ece0, 0 0 8px rgba(0,0,0,.35); }

/* ---- Option C: constant-contrast silhouette on a side chip ---- */
[data-opt="c"] .piece { inset: 11%; z-index: 1; }
[data-opt="c"] .piece svg > g { stroke-width: 3; fill: #1a1712; stroke: #1a1712; }
[data-opt="c"] .piece circle.eye { fill: #efe8da; stroke: none; }
[data-opt="c"] .piece .cut { stroke: #efe8da; stroke-width: 4; }
[data-opt="c"] .chip {
  position: absolute; inset: 4%; border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0,0,0,.3);
}
[data-opt="c"][data-side="w"] .chip { background: #f6f1e4; border: 1.5px solid #6d5a3e; }
[data-opt="c"][data-side="b"] .chip { background: #55636e; border: 1.5px solid #cfd8de; }
[data-opt="c"][data-side="b"] .piece svg > g { fill: #0e1216; stroke: #0e1216; }
[data-opt="c"][data-side="b"] .piece circle.eye { fill: #cfd8de; }
[data-opt="c"][data-side="b"] .piece .cut { stroke: #cfd8de; }
/* In shadow mode the chip IS the ring. */
[data-opt="c"] .glow { display: none; }
.strip.dark [data-opt="c"] .chip { inset: 15%; border-radius: 50%; }
.strip.dark [data-opt="c"] .piece { inset: 21%; }
`;

function section(opt) {
  return `
<h2>${opt.name}</h2>
<p class="lede">${opt.blurb}</p>

<h3>Daylight — all six types, both sides, on both square colours</h3>
<div class="strip">${daylightRow(opt.id)}</div>
<div class="labels">${['♙','♘','♗','♖','♕','♔'].map(() => '<span></span>').join('')}</div>
<p class="note">Left six: White. Right six: Black. Pawn, knight, bishop, rook, queen, king.</p>

<h3>Shadow mode — the occupancy ring over the influence map</h3>
<div class="strip dark">${shadowRow(opt.id)}</div>
<div class="labels">${CASE_LABELS.concat(CASE_LABELS).map((l) => `<span>${esc(l)}</span>`).join('')}</div>
<p class="note">Left six: a White piece. Right six: a Black piece. The last two columns of
each half are the contested squares — the worst case.</p>

<h3>Shadow mode with silhouettes — the stress test</h3>
<div class="strip dark">${shadowPieceRow(opt.id)}</div>
<div class="labels">${CASE_LABELS.concat(CASE_LABELS).map((l) => `<span>${esc(l)}</span>`).join('')}</div>
<p class="note">The app does not draw pieces in shadow mode — this is here only to show
whether each treatment would survive if it ever did, which is the harshest test of the
fill/outline system.</p>

<p class="trade"><strong>Trades away.</strong> ${opt.trades}</p>
`;
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shadow Chess — distinguishing the two sides</title>
<style>${CSS}</style></head>
<body><div class="wrap">

<h1>Distinguishing White from Black</h1>
<p class="lede">Three mechanisms, rendered at the real size a piece occupies on a 375px
phone — 42px — using the app's actual piece shapes and its actual influence colours.
Nothing here is a mockup approximation.</p>

<h3>What makes this awkward</h3>
<p>Four constraints pull against each other:</p>
<ul>
<li><strong>The backdrop lightness varies enormously.</strong> In daylight it is two known
tones. In shadow mode it runs from an unlit square at roughly 13% lightness to a
White ×5 amber at about 58% — so any treatment resting on lightness alone has a band in
the middle where it thins out.</li>
<li><strong>Hue is already spoken for.</strong> Amber, cyan and violet carry the influence
map. Adding a hue cue for the sides would both collide with that and be the least
colour-blind-safe move available, so every option here is deliberately achromatic.</li>
<li><strong>Forty pixels.</strong> Texture and hatching — the obvious "make one side
different" move — alias into grey mush below about 60px at a 1.5× pixel ratio, and were
rejected for that reason. Likewise pure stroke-weight contrast: a queen carries more ink
than a pawn whatever side it is on, so weight cannot carry the distinction on its own.</li>
<li><strong>The ring is already there.</strong> Occupancy and selection are signalled at
the edge of the square, so anything else placed at that edge competes with them.</li>
</ul>

${OPTIONS.map(section).join('\n')}

<h2>Recommendation</h2>
<div class="rec" id="rec"></div>

</div></body></html>`;

mkdirSync(join(root, 'design'), { recursive: true });
writeFileSync(join(root, 'design/piece-options.html'), html);
console.log(`design/piece-options.html  ${(html.length / 1024).toFixed(0)} KB`);
