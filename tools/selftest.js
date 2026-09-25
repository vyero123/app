/**
 * tools/selftest.js — in-browser verification, appended to the bundle by
 * `node tools/bundle.mjs --selftest`. Not shipped.
 *
 * Node tests prove the influence engine is right. This proves the *rendering*
 * agrees with the engine in a real browser: it walks every position of the
 * game and compares each square's computed background colour against what the
 * colour model says it should be, checks the occupancy glow, checks the
 * spotlight, and re-checks a handful of squares whose control I worked out by
 * hand from the published final position.
 */

(function selftest() {
  const log = [];
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) pass++;
    else { fail++; log.push(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
  };

  const sqEl = (name) => document.querySelector(`.sq[data-square="${name}"]`);
  const bg = (el) => getComputedStyle(el).backgroundColor;
  const norm = (c) => {
    const m = c.match(/[\d.]+/g).slice(0, 3).map((n) => Math.round(Number(n)));
    return m.join(',');
  };

  const { player } = window.__shadowChess;
  const total = player.states.length;

  // Transitions must be off while we read computed colours: in a real browser
  // getComputedStyle returns the *interpolated* value mid-transition, so every
  // square would compare unequal for ~420ms after each goto(). (jsdom has no
  // transitions, so this only bites in a real browser — which is exactly why
  // it has to be checked in one.)
  const freeze = document.createElement('style');
  freeze.textContent = '.sq, .glow { transition: none !important; }';
  document.head.appendChild(freeze);

  // --- 1. rendering agrees with the model at every position ------------------
  let compared = 0;
  for (let ply = 0; ply < total; ply++) {
    player.goto(ply, { force: true, instant: true });
    const st = player.states[ply];
    for (let i = 0; i < 64; i++) {
      const el = document.querySelector(`.sq[data-idx="${i}"]`);
      const isLight = el.dataset.light === '1';
      const expected = squareColour(st.influence.w[i], st.influence.b[i], isLight);
      compared++;
      if (norm(bg(el)) !== norm(expected)) {
        ok(`ply ${ply} sq ${el.dataset.square} colour`, false,
           `dom ${bg(el)} vs model ${expected} (w=${st.influence.w[i]} b=${st.influence.b[i]})`);
        if (fail > 6) { log.push('…stopping colour comparison'); ply = total; break; }
      }
      const occupied = !!st.influence.cells[i];
      if (el.classList.contains('occupied') !== occupied) {
        ok(`ply ${ply} sq ${el.dataset.square} glow`, false,
           `class occupied=${el.classList.contains('occupied')} model=${occupied}`);
      }
    }
  }
  ok(`rendered colour matches model across ${compared} square-states`, fail === 0);
  ok(`timeline has 46 states (45 plies)`, total === 46, `got ${total}`);

  // --- 2. hand-derived control counts at the published final position --------
  player.goto(total - 1, { force: true, instant: true });
  const final = player.states[total - 1];
  const HAND = {
    // square: [whiteControl, blackControl] — worked out by hand from
    // r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1
    d8: [1, 1],   // white Be7 attacks d8; black Rh8 rakes the 8th to d8
    e8: [1, 3],   // white Ng7; black Rh8 + Nf6 + Kd8
    f7: [0, 0],   // nobody — the mate works without touching f7
    a1: [0, 0],   // the black queen sits on a square nothing controls
    f6: [3, 0],   // white Be7 + e5 pawn + Nd5 all bear on the knight; black: none
    c7: [1, 2],   // white Nd5; black Kd8 + Na6 (Bc8 does NOT — c8-c7 isn't a diagonal)
  };
  for (const [sq, [w, b]] of Object.entries(HAND)) {
    const i = squareToIdx(sq);
    ok(`final: ${sq} white control ${w}`, final.influence.w[i] === w, `got ${final.influence.w[i]}`);
    ok(`final: ${sq} black control ${b}`, final.influence.b[i] === b, `got ${final.influence.b[i]}`);
  }

  // --- 3. the pawn rule, visible on the board -------------------------------
  player.goto(1, { force: true, instant: true }); // after 1. e4
  {
    const st = player.states[1];
    const e4 = squareToIdx('e4'), d5 = squareToIdx('d5'), f5 = squareToIdx('f5'), e5 = squareToIdx('e5');
    ok('after 1.e4 the pawn controls d5', st.influence.w[d5] === 1, `got ${st.influence.w[d5]}`);
    ok('after 1.e4 the pawn controls f5', st.influence.w[f5] === 1, `got ${st.influence.w[f5]}`);
    ok('after 1.e4 nothing white controls e5 (push square is not influence)',
       st.influence.w[e5] === 0, `got ${st.influence.w[e5]}`);
    // e4 is defended by nothing: the queen's d1–h5 diagonal runs e2-f3-g4-h5,
    // the king and knights don't reach it, and Bf1 goes d3-c4-b5-a6. So the
    // pawn stands alone — and the square should render as White-only ×0, i.e.
    // no white tint at all despite a white pawn sitting on it.
    ok('after 1.e4 the pawn on e4 is itself undefended', st.influence.w[e4] === 0,
       `got ${st.influence.w[e4]}`);
    ok('after 1.e4 black does not yet reach e4', st.influence.b[e4] === 0,
       `got ${st.influence.b[e4]}`);
  }

  // --- 4. spotlight ---------------------------------------------------------
  player.goto(total - 1, { force: true, instant: true });
  {
    const be7 = sqEl('e7');
    be7.click();
    const board = document.getElementById('board');
    ok('clicking a piece enters isolate mode', board.classList.contains('isolating'));
    ok('the clicked square is marked selected', be7.classList.contains('sel'));
    // Be7 controls d8, f8, d6, c5, b4, a3, f6 — f6 is occupied so the ray stops.
    for (const s of ['d8', 'f8', 'd6', 'c5', 'b4', 'a3', 'f6']) {
      const el = sqEl(s);
      ok(`spotlight covers ${s}`, norm(bg(el)) === norm(isolateColour(el.dataset.light === '1', 2)),
         `bg ${bg(el)}`);
    }
    // g5 lies on the e7–h4 diagonal beyond f6; f6 is occupied, so no x-ray.
    ok('spotlight stops at the blocker: g5 not lit',
       norm(bg(sqEl('g5'))) !== norm(isolateColour(sqEl('g5').dataset.light === '1', 2)));
    be7.click();
    ok('clicking again leaves isolate mode', !board.classList.contains('isolating'));
  }

  // --- 5. controls ----------------------------------------------------------
  player.goto(0, { force: true, instant: true });
  document.getElementById('next').click();
  ok('next advances one ply', player.index === 1, `index ${player.index}`);
  document.getElementById('prev').click();
  ok('prev goes back one ply', player.index === 0, `index ${player.index}`);
  document.getElementById('last').click();
  ok('last jumps to the end', player.index === total - 1);
  ok('next is disabled at the end', document.getElementById('next').disabled);
  document.getElementById('first').click();
  ok('first jumps to the start', player.index === 0);
  ok('prev is disabled at the start', document.getElementById('prev').disabled);
  document.getElementById('scrub').value = '20';
  document.getElementById('scrub').dispatchEvent(new Event('input'));
  ok('scrubbing jumps to move 20', player.index === 20, `index ${player.index}`);

  // --- 6. layout at 375px ---------------------------------------------------
  // Skipped under a DOM shim with no layout engine (jsdom); it runs for real
  // in a browser, where getBoundingClientRect actually measures something.
  const hasLayout = document.getElementById('board').getBoundingClientRect().width > 0;
  if (!hasLayout) {
    log.push('SKIP layout checks — no layout engine in this environment');
  } else {
    const b = document.getElementById('board').getBoundingClientRect();
    ok('board is square', Math.abs(b.width - b.height) < 2, `${b.width}x${b.height}`);
    ok('board fits the viewport width', b.width <= window.innerWidth,
       `board ${b.width} vs vw ${window.innerWidth}`);
    ok('board is not tiny', b.width > 250, `${b.width}`);
    ok('no horizontal overflow',
       document.documentElement.scrollWidth <= window.innerWidth + 1,
       `scrollWidth ${document.documentElement.scrollWidth} vw ${window.innerWidth}`);
    for (const id of ['play', 'next', 'prev', 'first', 'last']) {
      const r = document.getElementById(id).getBoundingClientRect();
      ok(`${id} is a comfortable tap target`, r.height >= 44 && r.width >= 40,
         `${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }

  player.goto(0, { force: true, instant: true });
  freeze.remove();

  console.log(`SELFTEST ${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
  for (const l of log) console.error(l);
  window.__selftest = { pass, fail, log };
})();
