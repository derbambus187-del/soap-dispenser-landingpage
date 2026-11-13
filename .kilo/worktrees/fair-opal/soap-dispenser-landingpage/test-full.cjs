const fs = require('fs');
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

let noImports = f
  .replace(/^import \{ writeFileSync, mkdirSync, existsSync \} from 'fs';$/m, 'const { writeFileSync, mkdirSync, existsSync } = require("fs");')
  .replace(/^import \{ join \} from 'path';$/m, 'const { join } = require("path");')
  .replace(/^import sharp from 'sharp';$/m, 'const sharp = { webp: () => ({ toFile: async () => {} }), resize: () => ({ webp: () => ({ toFile: async () => {} }) }) };');

// Find the end of FILTERS
const filtersStart = noImports.indexOf('const FILTERS = `');
let pos = filtersStart + 18;
let endBacktick = -1;
while (pos < noImports.length) {
  const idx = noImports.indexOf('`', pos);
  if (idx === -1) break;
  const nextChar = noImports[idx + 1];
  if (nextChar === ')' || nextChar === ';' || nextChar === '\n') {
    endBacktick = idx;
    break;
  }
  pos = idx + 1;
}

const part1 = noImports.substring(0, endBacktick + 1);
const part2 = noImports.substring(endBacktick + 1);
const fullCode = part1 + '\n' + part2;

fs.writeFileSync('/tmp/full.cjs', fullCode);

try {
  require('/tmp/full.cjs');
  console.log('Full script parses OK');
} catch(e) {
  console.log('Full script error:', e.message);
  console.log('Stack:', e.stack);
}