const fs = require('fs');
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

let noImports = f
  .replace(/^import \{ writeFileSync, mkdirSync, existsSync \} from 'fs';$/m, 'const { writeFileSync, mkdirSync, existsSync } = require("fs");')
  .replace(/^import \{ join \} from 'path';$/m, 'const { join } = require("path");')
  .replace(/^import sharp from 'sharp';$/m, 'const sharp = { webp: () => ({ toFile: async () => {} }), resize: () => ({ webp: () => ({ toFile: async () => {} }) }) };');

// Find FILTERS in the modified content
const filtersStart = noImports.indexOf('const FILTERS = `');
console.log('filtersStart in modified:', filtersStart);

// Find the closing backtick
let pos = filtersStart + 18;
let found = false;
while (pos < noImports.length) {
  const idx = noImports.indexOf('`', pos);
  if (idx === -1) break;
  const nextChar = noImports[idx + 1];
  if (nextChar === ')' || nextChar === ';' || nextChar === '\n') {
    console.log('Closing backtick at:', idx, 'next:', JSON.stringify(nextChar));
    const filtersCode = noImports.substring(filtersStart, idx + 1);
    fs.writeFileSync('/tmp/filters.cjs', filtersCode + '\nconsole.log("FILTERS length:", FILTERS.length);');
    try {
      require('/tmp/filters.cjs');
      console.log('FILTERS parses OK');
    } catch(e) {
      console.log('FILTERS error:', e.message);
    }
    found = true;
    break;
  }
  pos = idx + 1;
}
if (!found) console.log('No closing backtick found');