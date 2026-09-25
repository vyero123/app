import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
// Re-import the mark builders by evaluating the generator's functions.
const SQ = 42;
const mod = await import('./marks-export.mjs');
const { chipMark, oxMark, ringMark } = mod;

function pctTintVisible(markFn, side, king, bgHex) {
  const body = markFn ? markFn(side, king) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SQ}" height="${SQ}"><rect width="${SQ}" height="${SQ}" fill="${bgHex}"/>${body}</svg>`;
  const buf = new Resvg(svg, { fitTo: { mode: 'zoom', value: 4 } }).render().asPng();
  const png = PNG.sync.read(buf);
  const want = bgHex.match(/\d+/g).map(Number);
  let hit = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const d = Math.abs(png.data[i]-want[0]) + Math.abs(png.data[i+1]-want[1]) + Math.abs(png.data[i+2]-want[2]);
    if (d <= 12) hit++;
  }
  return (100 * hit / (png.width * png.height)).toFixed(1);
}

const BG = 'rgb(186,131,46)'; // a loud amber square
console.log('percentage of the square still showing its influence tint, amber x4:');
for (const [name, fn] of [['old ring (option A)', ringMark], ['square chip', chipMark], ['O / X', oxMark]]) {
  console.log(` ${name.padEnd(20)} White ${pctTintVisible(fn,'w',false,BG)}%   Black ${pctTintVisible(fn,'b',false,BG)}%   King(W) ${pctTintVisible(fn,'w',true,BG)}%`);
}
console.log(` ${'nothing at all'.padEnd(20)} ${pctTintVisible(null,'w',false,BG)}%`);
