/**
 * influence.js — hand-rolled attack/control map computation.
 *
 * DEFINITION OF "INFLUENCE" (see README for the prose version):
 *
 *  A square is *controlled* by a piece if that piece attacks it RIGHT NOW,
 *  including squares occupied by its own pieces (defending is real influence)
 *  and squares occupied by enemy pieces (that's a capture).
 *
 *  - Pawns control exactly their two forward diagonals. They do NOT control
 *    the square(s) they can push to. A pawn on the a- or h-file controls only
 *    one square.
 *  - Knights control their 8 jump targets, unblockable.
 *  - Bishops/rooks/queens ray outwards and STOP at the first occupied square.
 *    That occupied square IS controlled (captured or defended); everything
 *    beyond it is NOT. There is NO x-ray: a rook behind a friendly rook does
 *    not control squares past it, and a bishop does not see "through" a pawn.
 *  - Kings control their 8 neighbours. We deliberately do not subtract squares
 *    the enemy also controls: legality is a separate concept from influence,
 *    and a king does genuinely bear on those squares.
 *  - En passant target squares and castling transit squares are NOT influence.
 *    They are move availability, not control.
 *
 * Everything here is computed from the raw piece placement only. chess.js is
 * used for PGN parsing and legality; it is never asked for attack maps.
 */

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** Square index 0..63, where 0 = a1 and 63 = h8. */
export function idx(file, rank) {
  return rank * 8 + file;
}
export function fileOf(i) {
  return i % 8;
}
export function rankOf(i) {
  return (i / 8) | 0;
}
/** 'e4' -> index */
export function squareToIdx(sq) {
  return idx(sq.charCodeAt(0) - 97, sq.charCodeAt(1) - 49);
}
/** index -> 'e4' */
export function idxToSquare(i) {
  return FILES[fileOf(i)] + (rankOf(i) + 1);
}

const KNIGHT_DELTAS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_DELTAS = [
  [0, 1], [1, 1], [1, 0], [1, -1],
  [0, -1], [-1, -1], [-1, 0], [-1, 1],
];
const ROOK_RAYS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const BISHOP_RAYS = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const QUEEN_RAYS = ROOK_RAYS.concat(BISHOP_RAYS);

const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

/**
 * Convert a chess.js `board()` result (8 rows, rank 8 first, each cell either
 * null or {square, type, color}) into a flat 64-entry array indexed a1..h8.
 */
export function flattenBoard(board) {
  const cells = new Array(64).fill(null);
  for (let row = 0; row < 8; row++) {
    const rank = 7 - row; // board()[0] is rank 8
    for (let file = 0; file < 8; file++) {
      const p = board[row][file];
      if (p) cells[idx(file, rank)] = { type: p.type, color: p.color };
    }
  }
  return cells;
}

/**
 * Squares controlled by the single piece standing on `from`.
 * Returns an array of square indices. Order is not significant.
 */
export function squaresControlledBy(cells, from) {
  const piece = cells[from];
  if (!piece) return [];
  const f = fileOf(from);
  const r = rankOf(from);
  const out = [];

  switch (piece.type) {
    case 'p': {
      // Forward diagonals only. NOT the push square.
      const dr = piece.color === 'w' ? 1 : -1;
      for (const df of [-1, 1]) {
        const nf = f + df;
        const nr = r + dr;
        if (onBoard(nf, nr)) out.push(idx(nf, nr));
      }
      return out;
    }
    case 'n': {
      for (const [df, dr] of KNIGHT_DELTAS) {
        const nf = f + df;
        const nr = r + dr;
        if (onBoard(nf, nr)) out.push(idx(nf, nr));
      }
      return out;
    }
    case 'k': {
      for (const [df, dr] of KING_DELTAS) {
        const nf = f + df;
        const nr = r + dr;
        if (onBoard(nf, nr)) out.push(idx(nf, nr));
      }
      return out;
    }
    case 'b':
    case 'r':
    case 'q': {
      const rays =
        piece.type === 'b' ? BISHOP_RAYS : piece.type === 'r' ? ROOK_RAYS : QUEEN_RAYS;
      for (const [df, dr] of rays) {
        let nf = f + df;
        let nr = r + dr;
        while (onBoard(nf, nr)) {
          const i = idx(nf, nr);
          out.push(i); // controlled whether empty, friendly (defended) or enemy
          if (cells[i]) break; // blocked — no x-ray past any occupant
          nf += df;
          nr += dr;
        }
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * Full influence map for a position.
 *
 * Returns:
 *   {
 *     cells,                    // flat 64 array of {type,color}|null
 *     w: Int8Array(64),         // number of white pieces controlling square
 *     b: Int8Array(64),         // number of black pieces controlling square
 *     attackers: Array(64) of [fromIdx, ...],
 *     controlledBy: Map(fromIdx -> [squareIdx, ...]),
 *   }
 */
export function computeInfluence(board) {
  const cells = flattenBoard(board);
  const w = new Int8Array(64);
  const b = new Int8Array(64);
  const attackers = Array.from({ length: 64 }, () => []);
  const controlledBy = new Map();

  for (let from = 0; from < 64; from++) {
    const piece = cells[from];
    if (!piece) continue;
    const squares = squaresControlledBy(cells, from);
    controlledBy.set(from, squares);
    const counter = piece.color === 'w' ? w : b;
    for (const sq of squares) {
      counter[sq]++;
      attackers[sq].push(from);
    }
  }

  return { cells, w, b, attackers, controlledBy };
}
