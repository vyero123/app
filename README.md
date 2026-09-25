# Shadow Chess

A chess visualiser where you never see the pieces — only the influence they cast.

The board is drawn, but nothing stands on it. What you see instead is the field
of control: every square tinted by which side attacks or defends it, and how
heavily. Pieces betray themselves only by the glow around the square they
occupy, and by the shape of the shadow they throw.

**Phase 1** plays back famous historical games as a progression of influence
states. The Immortal Game (Anderssen–Kieseritzky, London 1851) is the default:
Anderssen gives away a bishop, both rooks and his queen, and you can watch the
amber field thin out to almost nothing while it tightens into a noose around
d8.

---

## What "influence" means here

This is the part that's easy to get wrong, so it's spelled out precisely. The
implementation lives in [`js/influence.js`](js/influence.js) and is computed
from scratch — chess.js is used only to parse PGN and track legality, never
asked for attack maps.

**A square is controlled by a piece if that piece attacks it right now.**

- **Defending counts.** A square occupied by your own piece, which one of your
  other pieces is protecting, is controlled by you. Defence is real influence;
  leaving it out would make the map badly misleading. At the starting position
  d2 shows White ×4 — king, queen, knight and bishop all cover it.
- **Pawns control their two forward diagonals and nothing else.** A pawn does
  **not** control the square it can push to. This is the single most common
  error in visualisations like this one. After `1. e4`, the pawn controls d5
  and f5; e5 gets no white tint at all. A pawn on the a- or h-file controls one
  square, not two.
- **Sliding pieces stop at the first piece they meet.** The occupied square
  *is* controlled — that's either a capture or a defence — but nothing beyond
  it is.
- **No x-ray.** This is a deliberate choice, and it cuts both ways: a rook
  behind a friendly rook does not control squares past it, and a bishop does
  not see through a pawn it is defending. The alternative (counting x-rays
  through friendly pieces) is defensible and arguably more useful for
  evaluating a position, but it isn't *immediate control*, and the whole point
  here is to show what a side actually bears on this instant. If you want to
  change it, it is a few lines in `squaresControlledBy`.
- **Kings control all eight neighbours**, including squares the enemy also
  controls. A king can't legally move into check, but legality is a different
  concept from influence, and the king genuinely does bear on those squares —
  a piece landing there can be taken.
- **Knights control their eight jump targets**, unblockable.
- **Not influence:** en-passant target squares, castling transit squares,
  pawn pushes. Those are move availability, which is a different map.

### Verification

A plausible-looking wrong attack map is the main risk in a project like this,
so the influence engine is checked three ways:

1. **Hand-derived assertions** — counts on the starting position and on
   constructed positions (blocked rays, adjacent kings, en passant, a queen
   behind her own pawn) that were worked out on paper first.
2. **A differential check against chess.js's own `attackers()`**, run over
   every square, for both colours, at every position in every bundled game.
   chess.js arrives at attacks by a completely different route, so agreement
   is meaningful evidence rather than a tautology.
3. **A rendering check in a DOM**, comparing every square's computed
   background colour against what the colour model says it should be, across
   all 46 positions — so a correct engine can't be undone by a wrong paint.

```sh
node tests/influence.test.mjs          # engine: 60 assertions

npm i jsdom
node tools/bundle.mjs --selftest
node tools/run-selftest.mjs            # rendering and interaction
```

The layout assertions in the self-test are skipped under jsdom (no layout
engine) and run only in a real browser. One trap worth knowing about if you
extend these: in a real browser `getComputedStyle` returns the *interpolated*
colour while a transition is running, so the self-test disables transitions
before comparing anything. Without that, every square mismatches for the
420ms after each position change and the results are meaningless noise.

---

## The colour scheme

| | |
|---|---|
| **Amber** (hue 38°) | only White controls the square |
| **Cyan** (hue 190°) | only Black controls it |
| **Violet** (hue 288°) | both sides control it |
| **Chartreuse** (hue 78°) | the spotlight — one piece's own influence |

**Merging.** A contested square is not produced by compositing a white layer
over a black layer. That gives you a muddy, order-dependent colour that drifts
toward grey exactly where the board is most interesting — which is how these
visualisations usually fall apart. Instead every square gets *one* colour,
looked up deterministically from the pair of counts, so contested squares are a
deliberate third hue. Amber and cyan sit far enough apart on the wheel that
violet reads as clearly neither.

The violet also **leans**: the hue shifts up to ±26° toward whichever side has
more attackers, warming toward magenta when White is ahead on a square and
cooling toward blue-violet when Black is. So you can read the balance of a
contested square, not just the fact of contention.

**Intensity.** The ramp is five **discrete** steps, not a continuous function:
alpha 0.26 / 0.43 / 0.57 / 0.69 / 0.80 for 1 / 2 / 3 / 4 / 5+ attackers, with a
small lightness lift at the top end so deep squares don't collapse into
darkness. Discrete steps are what make "two attackers" distinguishable from
"three" at a glance; a smooth ramp reads as one smear. For a single-sided
square the count is that side's attackers; for a contested square it is the
total, so a 4-v-4 square is emphatically the loudest thing on the board.

If you want the exact numbers rather than the colour, tick **Show attacker
counts** — White's count appears top-left of each square, Black's bottom-right.
It's also how you'd sanity-check the map yourself.

**Occupancy.** A square with a piece on it gets a glowing inset ring — **white
for White, black for Black**, so you can always tell whose piece you're looking
at. Each ring carries a thin contrasting keyline just outside it, because a
white ring would disappear on a pale amber square and a black one would
disappear on an unlit square. That's the only thing that leaks piece identity,
and it leaks only *side*: a rook and a bishop are indistinguishable, and you
can only tell them apart by the shadow they throw.

**Spotlight.** Tap any glowing square to isolate that piece: its own influence
lights up chartreuse while everything else dims to a fifth of its intensity.
Tap again (or press Escape) to release. This is the quickest way to see what a
single piece is actually doing — try the white bishop on e7 in the final
position.

---

## Games and sources

Bundled in [`games/games.js`](games/games.js):

- **The Immortal Game** — Anderssen–Kieseritzky, casual game, London,
  21 June 1851. Move list per Kieseritzky's own report in *La Régence*,
  July 1851, as set out in the Wikipedia article
  [Immortal Game](https://en.wikipedia.org/wiki/Immortal_Game).

  *A caution worth repeating:* many circulating copies — including the popular
  Lichess import — permute moves 18–19 as `18...Qxa1+ 19.Ke2 Bxg1 20.e5`.
  That transposes to the same position but is not what Kieseritzky reported,
  and Wikipedia flags it explicitly as incorrect. This repo uses the reported
  order: `18...Bxg1 19.e5 Qxa1+ 20.Ke2`. It matters here, because the
  intermediate influence states differ even though the final position doesn't —
  and intermediate states are the whole point of this app. The last few moves
  from `20...Na6` were most likely announced rather than played over the board.

- **The Evergreen Game** — Anderssen–Dufresne, Berlin 1852, per the Wikipedia
  article [Evergreen Game](https://en.wikipedia.org/wiki/Evergreen_Game).

### Adding a game

Append an entry to `GAMES` in `games/games.js`:

```js
{
  id: 'opera-1858',
  title: 'The Opera Game',
  white: 'Paul Morphy',
  black: 'Duke Karl / Count Isouard',
  event: 'Paris Opera House, 1858',
  opening: 'Philidor Defence (C41)',
  source: 'Where you got it. Be specific — a URL and a date.',
  note: 'Anything odd about the transcription.',
  expectedPlies: 33,
  expectedFinalFen: '…',
  pgn: `…`,
}
```

`expectedPlies` and `expectedFinalFen` are optional but strongly recommended.
`tests/influence.test.mjs` asserts them, which is how a mis-transcribed PGN
gets caught instead of quietly rendering a wrong board. To get the final FEN,
load the PGN once and print `chess.fen()` — then **check that position against
the published one** before committing it. A FEN copied out of your own broken
parse proves nothing.

The game picker and the URL parameter (`?game=opera-1858`) pick it up
automatically.

---

## Running it

No build step. Serve the directory over HTTP (ES modules won't load from
`file://`):

```sh
python3 -m http.server 8000
```

Deployment is Netlify from `main`, repo root, no build command, serving
`index.html`.

### Controls

Next / previous / first / last, a scrubber to jump to any move, and autoplay
with five speeds from 2.4s to 0.45s per move. Keyboard: `←` `→` to step,
space to play/pause, `Home` / `End`, `Esc` to clear the spotlight.

Transitions between positions ripple outwards from the square just moved to,
with a small per-square delay, so a move reads as a disturbance propagating
through the field. `prefers-reduced-motion` turns this off.

### Layout

Mobile-first, designed at 375px. The board is a CSS grid with `aspect-ratio: 1`
that fills the available width; controls are a five-across row of 46px targets
below it; the legend, move list and game notes are collapsed into `<details>`
panels so the board and transport are the only things above the fold on a
phone. It widens to a 560px column on larger screens rather than stretching.

---

## Layout of the repo

```
index.html           entry point
css/style.css
js/influence.js      the attack-map engine — the heart of it
js/colour.js         counts -> one colour per square
js/board.js          DOM rendering and transitions
js/playback.js       PGN -> timeline of influence states
js/main.js           wiring
games/games.js       bundled PGNs with provenance
tests/               node test harness for the engine
tools/               bundler and in-browser self-test (not deployed)
vendor/chess.js/     vendored chess.js 1.4.0
```

## Licence and credits

[chess.js](https://github.com/jhlywa/chess.js) 1.4.0 by Jeff Hlywa, vendored in
`vendor/chess.js/` and used under the **BSD 2-Clause** licence, reproduced in
full at [`vendor/chess.js/LICENSE`](vendor/chess.js/LICENSE). (Note: chess.js
was MIT-licensed in its 0.x series and changed to BSD-2-Clause for 1.x. Both are
permissive; both require the notice be kept, which is why the licence file
ships with the vendored copy.) It is used for PGN parsing and move legality
only. Everything else here, including all influence computation, is original.
