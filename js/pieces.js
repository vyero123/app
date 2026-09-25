/**
 * pieces.js — the chess pieces, as SVG.
 *
 * WHY NOT UNICODE. The first version of daylight mode drew ♙♘♗♖♕♔ as text.
 * That breaks: no single font on a phone covers the chess block well, so the
 * browser resolves each codepoint to whatever font it can find, and you get a
 * different font per piece. On iOS the white pawn came out as a *solid black*
 * shape (the fallback draws U+2659 filled rather than outlined) and the pawns
 * rendered far larger than the back rank, because the fallback fonts have
 * unrelated metrics. No amount of font-size tuning fixes it — the fallback
 * chain differs per device.
 *
 * So the pieces are drawn here instead: one shared 100×100 viewBox, one shared
 * base plinth, and sizes matched BY EYE at board scale rather than by nominal
 * box. A knight and a pawn that fill the same box do not look the same size.
 *
 * Colour and outline are CSS's job (see .piece svg in style.css): white pieces
 * are light with a dark keyline, black pieces dark with a light one, so both
 * stay legible on both board colours. `paint-order: stroke` puts the keyline
 * behind the fill so it reads as an outline rather than eating the shape.
 *
 * These shapes are original to this project — no third-party piece set, so
 * nothing to attribute and no share-alike to propagate.
 */

/** Every piece stands on the same plinth, so the set reads as a set. */
const BASE =
  '<path d="M27 70h46c3.2 0 5.4 2.1 6.2 5.1l2.1 7.6c.9 3.2-1.1 5.8-4.4 5.8H23.1c-3.3 0-5.3-2.6-4.4-5.8l2.1-7.6c.8-3 3-5.1 6.2-5.1z"/>';

/** A narrower plinth for the pawn, which is a smaller piece overall. */
const BASE_SMALL =
  '<path d="M32 70h36c3 0 5 2 5.8 4.8l1.9 7c.9 3.1-1 5.7-4.2 5.7H28.5c-3.2 0-5.1-2.6-4.2-5.7l1.9-7c.8-2.8 2.8-4.8 5.8-4.8z"/>';

const SHAPES = {
  p: `
    <circle cx="50" cy="31.5" r="11.5"/>
    <path d="M39.5 40.5c6.4 4.6 14.6 4.6 21 0-.9 10.4-3.6 19-6 24.5h-9c-2.4-5.5-5.1-14.1-6-24.5z"/>
    ${BASE_SMALL}`,

  r: `
    <path d="M25 16h10.5v7h9.5v-7h10v7h9.5v-7H75v15.5l-6.5 5.5v22l6.5 5.5V70H25v-5.5l6.5-5.5v-22L25 31.5z"/>
    ${BASE}`,

  /* Head in profile facing left: pricked ear at the top, forehead sloping down
     to the muzzle at lower left, jaw tucked under, mane down the right into a
     neck that spans the plinth. The first attempt at this read as a teardrop
     blob at board size — a knight needs the muzzle to actually jut out. */
  n: `
    <path d="M34 70c0-11 2-18 6-24l-7 4c-4 2-8-1-6-5 3-9 9-17 17-22 4-3 8-5 11-6l1-9 7 5c9 6 14 16 15 27 2 10 1 20 0 30z"/>
    <circle class="eye" cx="45" cy="29" r="3"/>
    ${BASE}`,

  b: `
    <circle cx="50" cy="10.5" r="4.6"/>
    <path d="M50 16.5c8.6 8.4 14.4 16.8 14.4 24.6 0 8.2-6.4 14.2-14.4 14.2s-14.4-6-14.4-14.2c0-7.8 5.8-16.2 14.4-24.6z"/>
    <path class="cut" d="M42 36.5L58 22"/>
    <path d="M36.5 50.5h27L60.8 64H39.2z"/>
    ${BASE}`,

  q: `
    <circle cx="17" cy="27" r="5.4"/>
    <circle cx="33.5" cy="19" r="5.4"/>
    <circle cx="50" cy="14.5" r="6.2"/>
    <circle cx="66.5" cy="19" r="5.4"/>
    <circle cx="83" cy="27" r="5.4"/>
    <path d="M17 29.5l8.5 34.5h49L83 29.5 68.5 43.5 62 20 50 46.5 38 20l-6.5 23.5z"/>
    ${BASE}`,

  k: `
    <path d="M45 3h10v7.5h8v9h-8V29H45v-9.5h-8v-9h8z"/>
    <path d="M50 26.5c-11 0-19.5 8.6-19.5 19.2 0 7 3.6 12.4 6.8 18.3h25.4c3.2-5.9 6.8-11.3 6.8-18.3 0-10.6-8.5-19.2-19.5-19.2z"/>
    ${BASE}`,
};

/**
 * Optical size correction. Matched by eye at 42px squares against the white
 * rook, which is the reference the shapes were tuned to. The pawn is
 * deliberately a touch smaller than the rest; the knight and bishop need a
 * nudge because their silhouettes are narrow and read small at the same box.
 */
const SCALE = { p: 0.9, r: 1, n: 1.02, b: 1, q: 1.02, k: 1.03 };

const cache = new Map();

/** SVG markup for a piece type. Colour comes from CSS. */
export function pieceSvg(type) {
  if (cache.has(type)) return cache.get(type);
  const s = SCALE[type] ?? 1;
  // Scale about the foot of the plinth so every piece keeps the same baseline.
  const g = `<g transform="translate(50 88) scale(${s}) translate(-50 -88)">${SHAPES[type]}</g>`;
  const svg =
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${g}</svg>`;
  cache.set(type, svg);
  return svg;
}

export const PIECE_TYPES = Object.keys(SHAPES);
