/**
 * tools/bundle.mjs — produces a single self-contained HTML file.
 *
 * This is NOT part of deployment. The site itself is plain ES modules with no
 * build step; index.html at the repo root is the real entry point. This script
 * exists so the app can be previewed somewhere that only accepts one file
 * (a hosted artifact, an email attachment, a USB stick).
 *
 *   node tools/bundle.mjs            -> dist/shadow-chess.html
 *
 * It concatenates the modules in dependency order and strips the import/export
 * keywords. That works only because this project has no circular imports, no
 * name collisions, and no dynamic imports — if that stops being true, reach for
 * a real bundler instead of patching this.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const ORDER = [
  'vendor/chess.js/chess.js',
  'js/influence.js',
  'js/colour.js',
  'js/pieces.js',
  'js/board.js',
  'games/games.js',
  'js/playback.js',
  'js/main.js',
];

function strip(src) {
  return src
    // drop whole-line imports (single and multi-line)
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    // `export const x` -> `const x`, `export function` -> `function`, etc.
    .replace(/^export\s+(const|let|var|function|class|async)\b/gm, '$1')
    // drop bare `export { ... };` lists
    .replace(/^export\s*\{[\s\S]*?\};?\s*$/gm, '')
    .replace(/^export\s+default\s+/gm, 'const __default = ');
}

const withSelftest = process.argv.includes('--selftest');

let js = ORDER.map((p) => `\n/* ===== ${p} ===== */\n` + strip(read(p))).join('\n');
if (withSelftest) js += `\n/* ===== tools/selftest.js ===== */\n` + read('tools/selftest.js');
const css = read('css/style.css');

let html = read('index.html')
  .replace(
    /<link rel="stylesheet" href="css\/style.css">/,
    `<style>\n${css}\n</style>`
  )
  .replace(
    /<script type="module" src="js\/main.js"><\/script>/,
    // A classic script, not a module: after stripping imports there is nothing
    // module-specific left, and classic scripts run in more places (including
    // file:// and the jsdom harness, which has no ES-module support).
    `<script>\n${js}\n</script>`
  )
  // README isn't bundled; point the links at the repo instead.
  .replace(/href="README\.md"/g, 'href="https://github.com/vyero123/app#readme"')
  .replace(
    /href="vendor\/chess\.js\/LICENSE"/g,
    'href="https://github.com/jhlywa/chess.js/blob/master/LICENSE"'
  );

const out = withSelftest ? 'dist/shadow-chess-selftest.html' : 'dist/shadow-chess.html';
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, out), html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
