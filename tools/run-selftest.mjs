/**
 * tools/run-selftest.mjs — runs the in-browser self-test under jsdom.
 *
 *   npm i jsdom && node tools/run-selftest.mjs
 *
 * jsdom has no layout engine, so the 375px layout assertions are skipped here
 * and must be checked in a real browser. Everything else — the rendered colour
 * of all 64 squares across all 46 positions, occupancy glow, spotlight,
 * transport controls — runs for real against the actual DOM the app builds.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist/shadow-chess-selftest.html'), 'utf8');

const lines = [];
const vc = new VirtualConsole();
vc.on('log', (...a) => lines.push(['log', a.join(' ')]));
vc.on('error', (...a) => lines.push(['error', a.join(' ')]));
vc.on('warn', (...a) => lines.push(['warn', a.join(' ')]));
vc.on('jsdomError', (e) => lines.push(['error', 'jsdomError: ' + (e.stack || e.message)]));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: 'https://example.invalid/',
});

await new Promise((r) => setTimeout(r, 1500));

for (const [level, text] of lines) {
  console[level === 'error' ? 'error' : 'log'](text);
}

const result = dom.window.__selftest;
if (!result) {
  console.error('\nSelf-test did not run — the page probably threw during startup.');
  process.exit(1);
}
process.exit(result.fail ? 1 : 0);
