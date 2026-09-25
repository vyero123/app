/**
 * board.js — DOM rendering of the influence map.
 *
 * The board is built once as 64 persistent cells; every position change is a
 * property update on the same elements, so CSS transitions do the work of
 * animating between influence states. Nothing is torn down and rebuilt.
 *
 * The transition is a ripple: squares nearer the square just moved to begin
 * their colour change first, with a small per-square delay. It reads as the
 * move propagating outwards through the influence field, which is more or
 * less what actually happens.
 */

import { fileOf, rankOf, idxToSquare, FILES } from './influence.js';
import { squareColour, dimmedColour, isolateColour } from './colour.js';
import { pieceSvg } from './pieces.js';

const PIECE_NAMES = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

/** Classic board colours, used only in daylight mode. */
const DAY_LIGHT = 'rgb(240 217 181)';
const DAY_DARK = 'rgb(181 136 99)';

export class BoardView {
  /** @param {HTMLElement} root the element that will hold the 8x8 grid */
  constructor(root) {
    this.root = root;
    this.cells = [];
    this.flipped = false;
    this.build();
  }

  build() {
    this.root.innerHTML = '';
    this.root.classList.add('board');
    for (let i = 0; i < 64; i++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sq';
      el.dataset.idx = String(i);
      el.dataset.square = idxToSquare(i);
      const isLight = (fileOf(i) + rankOf(i)) % 2 === 1;
      el.dataset.light = isLight ? '1' : '0';
      el.tabIndex = -1;

      const glow = document.createElement('span');
      glow.className = 'glow';
      el.appendChild(glow);

      const counts = document.createElement('span');
      counts.className = 'counts';
      counts.innerHTML =
        '<i class="cw"></i><i class="cb"></i>';
      el.appendChild(counts);

      const piece = document.createElement('span');
      piece.className = 'piece';
      el.appendChild(piece);

      this.cells.push(el);
    }
    this.layout();
    this.trackSquareSize();
  }

  /**
   * Publish the current square size as a CSS variable so the piece glyphs can
   * scale exactly with the board instead of guessing from viewport units.
   */
  trackSquareSize() {
    const set = () => {
      const w = this.root.getBoundingClientRect().width;
      if (w) this.root.style.setProperty('--sq', `${w / 8}px`);
    };
    set();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(set).observe(this.root);
    } else {
      window.addEventListener('resize', set);
    }
  }

  /** Place cells in DOM order for the current orientation. */
  layout() {
    const order = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const rank = this.flipped ? row : 7 - row;
        const file = this.flipped ? 7 - col : col;
        order.push(rank * 8 + file);
      }
    }
    const frag = document.createDocumentFragment();
    for (const i of order) frag.appendChild(this.cells[i]);
    this.root.appendChild(frag);
  }

  setFlipped(flipped) {
    this.flipped = flipped;
    this.layout();
  }

  fileLabels() {
    return this.flipped ? [...FILES].reverse() : FILES;
  }
  rankLabels() {
    const r = ['8', '7', '6', '5', '4', '3', '2', '1'];
    return this.flipped ? r.reverse() : r;
  }

  /**
   * @param {object} opts
   * @param {ReturnType<import('./influence.js').computeInfluence>} opts.influence
   * @param {{from:number,to:number}|null} opts.lastMove
   * @param {number|null} opts.selected index of the piece being isolated
   * @param {boolean} opts.showCounts
   * @param {boolean} opts.daylight  true = shadows off, real pieces shown
   * @param {boolean} opts.animate
   */
  render({ influence, lastMove, selected, showCounts, daylight = false, animate = true }) {
    const { w, b, cells, controlledBy } = influence;
    const origin = lastMove ? lastMove.to : 36; // e5-ish centre when no move yet

    // In daylight the shadows are switched off entirely: no tint, no
    // spotlight, no counts — just the position, drawn the ordinary way.
    const spotlight =
      !daylight && selected != null && controlledBy.has(selected)
        ? new Set(controlledBy.get(selected))
        : null;

    this.root.classList.toggle('daylight', daylight);
    this.root.classList.toggle('isolating', !!spotlight);
    this.root.classList.toggle('show-counts', !!showCounts && !daylight);

    for (let i = 0; i < 64; i++) {
      const el = this.cells[i];
      const isLight = el.dataset.light === '1';
      const piece = cells[i];

      if (animate) {
        const d =
          Math.max(
            Math.abs(fileOf(i) - fileOf(origin)),
            Math.abs(rankOf(i) - rankOf(origin))
          ) * 22;
        el.style.transitionDelay = `${d}ms`;
      } else {
        el.style.transitionDelay = '0ms';
      }

      if (daylight) {
        el.style.backgroundColor = isLight ? DAY_LIGHT : DAY_DARK;
      } else if (spotlight) {
        if (i === selected) {
          el.style.backgroundColor = isolateColour(isLight, 5);
        } else if (spotlight.has(i)) {
          el.style.backgroundColor = isolateColour(isLight, 2);
        } else {
          el.style.backgroundColor = dimmedColour(w[i], b[i], isLight);
        }
      } else {
        el.style.backgroundColor = squareColour(w[i], b[i], isLight);
      }

      el.classList.toggle('occupied', !!piece);
      el.classList.toggle('sel', i === selected);
      el.classList.toggle('from', !!lastMove && i === lastMove.from);
      el.classList.toggle('to', !!lastMove && i === lastMove.to);
      if (piece) {
        el.dataset.side = piece.color;
        el.dataset.piece = piece.type;
      } else {
        delete el.dataset.side;
        delete el.dataset.piece;
      }

      el.querySelector('.cw').textContent = w[i] ? String(w[i]) : '';
      el.querySelector('.cb').textContent = b[i] ? String(b[i]) : '';
      // Only touch the piece markup when it actually changes — re-setting
      // innerHTML on all 64 squares every frame would rebuild the SVGs for
      // nothing and kill the transition.
      const wantPiece = daylight && piece ? piece.type : '';
      const pieceEl = el.querySelector('.piece');
      if (pieceEl.dataset.shown !== wantPiece) {
        pieceEl.innerHTML = wantPiece ? pieceSvg(wantPiece) : '';
        pieceEl.dataset.shown = wantPiece;
      }

      el.disabled = !piece;
      const sq = el.dataset.square;
      el.setAttribute(
        'aria-label',
        piece
          ? `${sq}: ${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}.` +
            (daylight ? '' : ` White control ${w[i]}, Black control ${b[i]}.`)
          : `${sq}: empty.` +
            (daylight ? '' : ` White control ${w[i]}, Black control ${b[i]}.`)
      );
      el.setAttribute('aria-pressed', i === selected ? 'true' : 'false');
    }
  }

  onSquareClick(handler) {
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('.sq');
      if (!el || el.disabled) return;
      handler(Number(el.dataset.idx));
    });
  }
}
