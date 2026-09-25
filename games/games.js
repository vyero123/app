/**
 * Bundled games.
 *
 * To add a game, append an object with the same shape. `expectedPlies` and
 * `expectedFinalFen` are optional but recommended: tests/influence.test.mjs
 * asserts them, which is how a mis-transcribed PGN gets caught rather than
 * quietly rendering a wrong board. Get the final FEN by loading the PGN once
 * and printing `chess.fen()`, then eyeball it against the published final
 * position before committing it.
 */

export const GAMES = [
  {
    id: 'immortal-1851',
    title: 'The Immortal Game',
    white: 'Adolf Anderssen',
    black: 'Lionel Kieseritzky',
    event: 'Casual game, London 1851',
    opening: "King's Gambit Accepted: Bishop's Gambit, Bryan Countergambit (C33)",
    source:
      'Move list per Kieseritzky\'s own report in La Régence, July 1851, as set out in the Wikipedia article "Immortal Game" (https://en.wikipedia.org/wiki/Immortal_Game).',
    note:
      'Many circulating copies — including the popular Lichess import — permute moves 18–19 as 18...Qxa1+ 19.Ke2 Bxg1 20.e5. This transposes but is not what Kieseritzky reported. We use the reported order: 18...Bxg1 19.e5 Qxa1+ 20.Ke2. The last few moves (from 20...Na6) were most likely announced rather than played.',
    expectedPlies: 45,
    expectedFinalFen: 'r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1 b - - 1 23',
    pgn: `[Event "Casual Game"]
[Site "London ENG"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]
[ECO "C33"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6
7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6
13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2
18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6
23. Be7# 1-0`,
  },
  {
    id: 'evergreen-1852',
    title: 'The Evergreen Game',
    white: 'Adolf Anderssen',
    black: 'Jean Dufresne',
    event: 'Casual game, Berlin 1852',
    opening: 'Evans Gambit (C52)',
    source:
      'Move list as set out in the Wikipedia article "Evergreen Game" (https://en.wikipedia.org/wiki/Evergreen_Game).',
    note:
      'Anderssen again. A useful contrast to the Immortal: the influence map stays denser for longer before the final double-bishop mating net closes.',
    expectedPlies: 47,
    expectedFinalFen: '1r3kr1/pbpBBp1p/1b3P2/8/8/2P2q2/P4PPP/3R2K1 b - - 0 24',
    pgn: `[Event "Casual Game"]
[Site "Berlin GER"]
[Date "1852.??.??"]
[White "Adolf Anderssen"]
[Black "Jean Dufresne"]
[Result "1-0"]
[ECO "C52"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4
7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8
13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6
18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8
23. Bd7+ Kf8 24. Bxe7# 1-0`,
  },
];

export const DEFAULT_GAME_ID = 'immortal-1851';
