/**
 * playback.js — PGN to a timeline of influence states.
 *
 * chess.js does the PGN parsing and legality (it is good at the fiddly parts:
 * disambiguation, SAN edge cases, castling, promotion). We only take the
 * resulting piece placement from it and compute influence ourselves.
 */

import { Chess } from '../vendor/chess.js/chess.js';
import { computeInfluence, squareToIdx } from './influence.js';

/**
 * @returns {{
 *   headers: object,
 *   states: Array<{
 *     ply: number, san: string|null, moveNumber: number|null,
 *     side: 'w'|'b'|null, from: number|null, to: number|null,
 *     fen: string, influence: object
 *   }>
 * }}
 */
export function buildTimeline(pgn) {
  const parser = new Chess();
  parser.loadPgn(pgn); // throws on an unparseable or illegal game
  const moves = parser.history({ verbose: true });
  const headers = parser.header ? parser.header() : {};

  const replay = new Chess();
  const states = [
    {
      ply: 0,
      san: null,
      moveNumber: null,
      side: null,
      from: null,
      to: null,
      fen: replay.fen(),
      influence: computeInfluence(replay.board()),
    },
  ];

  moves.forEach((mv, i) => {
    replay.move(mv.san);
    states.push({
      ply: i + 1,
      san: mv.san,
      moveNumber: Math.floor(i / 2) + 1,
      side: mv.color,
      from: squareToIdx(mv.from),
      to: squareToIdx(mv.to),
      fen: replay.fen(),
      influence: computeInfluence(replay.board()),
    });
  });

  return { headers, states };
}

/** Summary numbers used by the readout under the board. */
export function summarise(influence) {
  const { w, b } = influence;
  let whiteOnly = 0, blackOnly = 0, contested = 0, dead = 0;
  let whiteTotal = 0, blackTotal = 0;
  for (let i = 0; i < 64; i++) {
    whiteTotal += w[i];
    blackTotal += b[i];
    if (w[i] && b[i]) contested++;
    else if (w[i]) whiteOnly++;
    else if (b[i]) blackOnly++;
    else dead++;
  }
  return { whiteOnly, blackOnly, contested, dead, whiteTotal, blackTotal };
}

export class Player {
  constructor(states, onChange) {
    this.states = states;
    this.onChange = onChange;
    this.index = 0;
    this.timer = null;
    this.intervalMs = 1200;
  }
  get current() {
    return this.states[this.index];
  }
  get playing() {
    return this.timer !== null;
  }
  get atEnd() {
    return this.index >= this.states.length - 1;
  }
  goto(i, opts = {}) {
    const clamped = Math.max(0, Math.min(this.states.length - 1, i));
    if (clamped === this.index && !opts.force) return;
    this.index = clamped;
    this.onChange(this.current, opts);
  }
  next() {
    if (this.atEnd) {
      this.pause();
      return;
    }
    this.goto(this.index + 1);
  }
  prev() {
    this.goto(this.index - 1);
  }
  play() {
    if (this.playing) return;
    if (this.atEnd) this.goto(0);
    this.timer = setInterval(() => this.next(), this.intervalMs);
    this.onChange(this.current, { statusOnly: true });
  }
  pause() {
    if (!this.playing) return;
    clearInterval(this.timer);
    this.timer = null;
    this.onChange(this.current, { statusOnly: true });
  }
  toggle() {
    this.playing ? this.pause() : this.play();
  }
  setSpeed(ms) {
    this.intervalMs = ms;
    if (this.playing) {
      clearInterval(this.timer);
      this.timer = setInterval(() => this.next(), this.intervalMs);
    }
  }
}
