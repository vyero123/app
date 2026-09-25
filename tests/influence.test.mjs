/**
 * Node test harness for the influence engine.
 *   node tests/influence.test.mjs
 *
 * Two kinds of check:
 *   1. Hand-verified assertions on positions I worked out on paper.
 *   2. A differential check against chess.js's own `attackers()` across every
 *      square of every position in every bundled game. chess.js computes
 *      attacks by a completely different route, so agreement is real evidence.
 */
import { Chess } from '../vendor/chess.js/chess.js';
import {
  computeInfluence,
  squaresControlledBy,
  flattenBoard,
  squareToIdx,
  idxToSquare,
} from '../js/influence.js';
import { GAMES } from '../games/games.js';

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}
function setEq(name, got, expected) {
  const g = [...new Set(got)].sort().join(' ');
  const e = [...new Set(expected)].sort().join(' ');
  check(name, g === e, `got [${g}] expected [${e}]`);
}

const inf = (fen) => computeInfluence(new Chess(fen).board());
const cellsOf = (fen) => flattenBoard(new Chess(fen).board());
const ctrl = (fen, sq) =>
  squaresControlledBy(cellsOf(fen), squareToIdx(sq)).map(idxToSquare);

// ---------------------------------------------------------------------------
console.log('\n1. Starting position — hand-verified');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
{
  const m = inf(START);
  const W = (sq) => m.w[squareToIdx(sq)];
  const B = (sq) => m.b[squareToIdx(sq)];

  // The pawn rule: e2 pawn controls d3 and f3 only.
  setEq('pawn e2 controls exactly d3,f3', ctrl(START, 'e2'), ['d3', 'f3']);
  setEq('pawn a2 controls exactly b3 (edge file)', ctrl(START, 'a2'), ['b3']);
  setEq('pawn h7 controls exactly g6 (edge file)', ctrl(START, 'h7'), ['g6']);
  check('e3 is NOT controlled by the e2 pawn', !ctrl(START, 'e2').includes('e3'));
  check('e4 is NOT controlled by the e2 pawn', !ctrl(START, 'e2').includes('e4'));

  // No x-ray: rook a1 stops at b1 and a2.
  setEq('rook a1 controls exactly b1,a2 (no x-ray)', ctrl(START, 'a1'), ['b1', 'a2']);
  setEq('bishop c1 controls exactly b2,d2 (boxed in)', ctrl(START, 'c1'), ['b2', 'd2']);
  setEq('queen d1 controls c1,c2,d2,e2,e1', ctrl(START, 'd1'), [
    'c1', 'c2', 'd2', 'e2', 'e1',
  ]);
  setEq('knight b1 controls a3,c3,d2', ctrl(START, 'b1'), ['a3', 'c3', 'd2']);
  setEq('king e1 controls d1,d2,e2,f2,f1', ctrl(START, 'e1'), [
    'd1', 'd2', 'e2', 'f2', 'f1',
  ]);

  // Rank 3 counts, worked out by hand.
  const rank3 = { a3: 2, b3: 2, c3: 3, d3: 2, e3: 2, f3: 3, g3: 2, h3: 2 };
  for (const [sq, n] of Object.entries(rank3)) {
    check(`white controls ${sq} x${n}`, W(sq) === n, `got ${W(sq)}`);
  }
  // Mirror for black on rank 6.
  const rank6 = { a6: 2, b6: 2, c6: 3, d6: 2, e6: 2, f6: 3, g6: 2, h6: 2 };
  for (const [sq, n] of Object.entries(rank6)) {
    check(`black controls ${sq} x${n}`, B(sq) === n, `got ${B(sq)}`);
  }

  // Ranks 4 and 5 are completely uncontrolled at the start.
  for (const f of 'abcdefgh') {
    for (const r of ['4', '5']) {
      check(`${f}${r} uncontrolled`, W(f + r) === 0 && B(f + r) === 0);
    }
  }

  // Defence is influence: d2 is defended by K, Q, N and B = 4 white.
  check('d2 defended x4 (K,Q,N,B)', W('d2') === 4, `got ${W('d2')}`);
  // Nothing is contested at the start.
  let contested = 0;
  for (let i = 0; i < 64; i++) if (m.w[i] > 0 && m.b[i] > 0) contested++;
  check('no contested squares at the start', contested === 0, `got ${contested}`);
}

// ---------------------------------------------------------------------------
console.log('\n2. Constructed positions — blocking, defence, kings');
{
  // White rook a1 behind white rook a3: no x-ray past a3.
  const fen = '7k/8/8/8/8/R7/8/R6K w - - 0 1';
  setEq('rook a1 stops at friendly rook a3', ctrl(fen, 'a1'), ['a2', 'a3', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1']);
  const m = inf(fen);
  check('a3 is controlled (defended) by white', m.w[squareToIdx('a3')] >= 1);
  check('a4 controlled by the a3 rook, not the a1 rook', m.w[squareToIdx('a4')] === 1);
}
{
  // Two kings adjacent-ish: kings control neighbours regardless of danger.
  const fen = '8/8/8/3k4/8/3K4/8/8 w - - 0 1';
  setEq('king d3 controls all 8 neighbours', ctrl(fen, 'd3'), [
    'c2', 'd2', 'e2', 'c3', 'e3', 'c4', 'd4', 'e4',
  ]);
  const m = inf(fen);
  check('d4 contested by both kings', m.w[squareToIdx('d4')] === 1 && m.b[squareToIdx('d4')] === 1);
}
{
  // En passant must NOT create influence.
  const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
  setEq('white e5 pawn controls only d6,f6', ctrl(fen, 'e5'), ['d6', 'f6']);
  check('e6 (push square) not controlled by the e5 pawn', !ctrl(fen, 'e5').includes('e6'));
}
{
  // Queen through a friendly pawn: blocked.
  const fen = '7k/8/8/8/8/8/3P4/3Q3K w - - 0 1';
  check('queen d1 controls d2 (defends pawn)', ctrl(fen, 'd1').includes('d2'));
  check('queen d1 does NOT control d3 (blocked)', !ctrl(fen, 'd1').includes('d3'));
}

// ---------------------------------------------------------------------------
console.log('\n3. Differential check vs chess.js attackers(), every position');
{
  let squaresChecked = 0;
  let mismatches = 0;
  for (const game of GAMES) {
    const c = new Chess();
    c.loadPgn(game.pgn);
    const history = c.history({ verbose: true });
    const replay = new Chess();
    const positions = [replay.fen()];
    for (const mv of history) {
      replay.move(mv.san);
      positions.push(replay.fen());
    }
    for (const fen of positions) {
      const pos = new Chess(fen);
      const m = computeInfluence(pos.board());
      for (let i = 0; i < 64; i++) {
        const sq = idxToSquare(i);
        for (const color of ['w', 'b']) {
          const theirs = pos.attackers(sq, color).length;
          const mine = (color === 'w' ? m.w : m.b)[i];
          squaresChecked++;
          if (theirs !== mine) {
            mismatches++;
            if (mismatches <= 10) {
              console.error(
                `  MISMATCH ${sq} ${color}: chess.js=${theirs} mine=${mine}  ${fen}`
              );
            }
          }
        }
      }
    }
  }
  check(
    `differential: ${squaresChecked} square/colour pairs agree with chess.js`,
    mismatches === 0,
    `${mismatches} mismatches`
  );
}

// ---------------------------------------------------------------------------
console.log('\n4. Bundled games parse to legal games');
for (const game of GAMES) {
  const c = new Chess();
  let ok = true;
  try {
    c.loadPgn(game.pgn);
  } catch (e) {
    ok = false;
    console.error('  ' + e.message);
  }
  check(`${game.id}: parses`, ok);
  if (ok) {
    check(`${game.id}: ${game.expectedPlies} plies`, c.history().length === game.expectedPlies, `got ${c.history().length}`);
    if (game.expectedFinalFen) {
      check(`${game.id}: final FEN matches source`, c.fen() === game.expectedFinalFen, `got ${c.fen()}`);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
