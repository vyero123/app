/** main.js — wiring. */

import { BoardView } from './board.js';
import { buildTimeline, Player, summarise } from './playback.js';
import { legendSwatches } from './colour.js';
import { GAMES, DEFAULT_GAME_ID } from '../games/games.js';
import { idxToSquare } from './influence.js';

const $ = (id) => document.getElementById(id);

const SPEEDS = [2400, 1800, 1200, 800, 450];

const board = new BoardView($('board'));
let player = null;
let selected = null;
let currentGame = null;

/* ---------- static chrome ---------- */

function paintCoords() {
  $('ranks').innerHTML = board.rankLabels().map((r) => `<span>${r}</span>`).join('');
  $('files').innerHTML = board.fileLabels().map((f) => `<span>${f}</span>`).join('');
}

function paintLegend() {
  $('legend').innerHTML = legendSwatches()
    .map((s) => `<div><i style="background:${s.colour}"></i>${s.label}</div>`)
    .join('');
}

function paintGamePicker() {
  $('gamepick').innerHTML = GAMES.map(
    (g) => `<option value="${g.id}">${g.title} — ${g.white} v ${g.black}</option>`
  ).join('');
}

function paintGameMeta(game) {
  $('gamemeta').innerHTML = `
    <h3>${game.title}</h3>
    <p>${game.white} — ${game.black}. ${game.event}.</p>
    <p>${game.opening}</p>
    <p><strong>Source.</strong> ${game.source}</p>
    ${game.note ? `<p><strong>Note.</strong> ${game.note}</p>` : ''}`;
}

/* ---------- per-position paint ---------- */

function paintMoveList(states) {
  const el = $('moves');
  el.innerHTML = '';
  states.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.ply = String(i);
    b.textContent =
      i === 0 ? 'start' : `${s.moveNumber}${s.side === 'w' ? '.' : '…'}${s.san}`;
    b.addEventListener('click', () => {
      player.pause();
      player.goto(i);
    });
    li.appendChild(b);
    el.appendChild(li);
  });
}

function paintStats(state) {
  const s = summarise(state.influence);
  $('stats').innerHTML = `
    <div class="stat w"><b>${s.whiteOnly}</b><span>WHITE ONLY</span></div>
    <div class="stat b"><b>${s.blackOnly}</b><span>BLACK ONLY</span></div>
    <div class="stat c"><b>${s.contested}</b><span>CONTESTED</span></div>
    <div class="stat d"><b>${s.dead}</b><span>NO CONTROL</span></div>`;
}

function render(state, opts = {}) {
  if (!opts.statusOnly) {
    // Selection follows the piece if it moved; otherwise it is dropped when
    // the square it was on no longer holds a piece.
    if (selected != null) {
      if (state.from === selected) selected = state.to;
      else if (!state.influence.cells[selected]) selected = null;
    }

    board.render({
      influence: state.influence,
      lastMove: state.from == null ? null : { from: state.from, to: state.to },
      selected,
      showCounts: $('counts').checked,
      animate: !opts.instant,
    });

    let text;
    if (state.ply === 0) {
      text = 'Starting position';
    } else {
      text = `${state.moveNumber}${state.side === 'w' ? '.' : '…'} ${state.san}`;
    }
    if (selected != null) {
      const p = state.influence.cells[selected];
      const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
      text += `  <em>spotlight: ${p.color === 'w' ? 'White' : 'Black'} ${names[p.type]} on ${idxToSquare(selected)}</em>`;
    }
    $('movetext').innerHTML = text;

    $('scrub').value = String(player.index);
    $('plylabel').textContent = `${player.index} / ${player.states.length - 1}`;
    paintStats(state);

    const buttons = $('moves').querySelectorAll('button');
    buttons.forEach((b) => b.classList.toggle('on', Number(b.dataset.ply) === player.index));
    const active = $('moves').querySelector('button.on');
    if (active && $('moves').offsetParent) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  $('play').textContent = player.playing ? '❚❚' : '▶';
  $('play').classList.toggle('on', player.playing);
  $('play').setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
  $('prev').disabled = player.index === 0;
  $('first').disabled = player.index === 0;
  $('next').disabled = player.atEnd;
  $('last').disabled = player.atEnd;
}

/* ---------- game loading ---------- */

function loadGame(id) {
  const game = GAMES.find((g) => g.id === id) || GAMES[0];
  currentGame = game;
  let timeline;
  try {
    timeline = buildTimeline(game.pgn);
  } catch (err) {
    $('movetext').textContent = `Could not parse ${game.title}: ${err.message}`;
    console.error(err);
    return;
  }
  if (player) player.pause();
  selected = null;
  player = new Player(timeline.states, render);
  window.__shadowChess = { game, player, timeline }; // handy for testing
  $('scrub').max = String(timeline.states.length - 1);
  $('gamepick').value = game.id;
  paintMoveList(timeline.states);
  paintGameMeta(game);
  player.goto(0, { force: true, instant: true });
}

/* ---------- events ---------- */

$('first').addEventListener('click', () => { player.pause(); player.goto(0); });
$('last').addEventListener('click', () => { player.pause(); player.goto(player.states.length - 1); });
$('prev').addEventListener('click', () => { player.pause(); player.prev(); });
$('next').addEventListener('click', () => { player.pause(); player.next(); });
$('play').addEventListener('click', () => player.toggle());

$('scrub').addEventListener('input', (e) => {
  player.pause();
  player.goto(Number(e.target.value));
});

$('speed').addEventListener('input', (e) => {
  const ms = SPEEDS[Number(e.target.value)];
  player.setSpeed(ms);
  $('speedlabel').textContent = `${(ms / 1000).toFixed(ms < 1000 ? 2 : 1)}s`;
});

$('counts').addEventListener('change', () => player.goto(player.index, { force: true, instant: true }));

$('flip').addEventListener('change', (e) => {
  board.setFlipped(e.target.checked);
  paintCoords();
  player.goto(player.index, { force: true, instant: true });
});

$('gamepick').addEventListener('change', (e) => loadGame(e.target.value));

$('about-toggle').addEventListener('click', (e) => {
  const open = $('about').hidden;
  $('about').hidden = !open;
  e.target.setAttribute('aria-expanded', String(open));
});

board.onSquareClick((i) => {
  selected = selected === i ? null : i;
  player.goto(player.index, { force: true, instant: true });
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, button')) {
    if (e.key !== ' ' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  }
  if (e.key === 'ArrowRight') { e.preventDefault(); player.pause(); player.next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); player.pause(); player.prev(); }
  else if (e.key === ' ') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'Home') { player.pause(); player.goto(0); }
  else if (e.key === 'End') { player.pause(); player.goto(player.states.length - 1); }
  else if (e.key === 'Escape' && selected != null) {
    selected = null;
    player.goto(player.index, { force: true, instant: true });
  }
});

/* ---------- go ---------- */

paintCoords();
paintLegend();
paintGamePicker();
$('speedlabel').textContent = `${(SPEEDS[2] / 1000).toFixed(1)}s`;
loadGame(new URLSearchParams(location.search).get('game') || DEFAULT_GAME_ID);
