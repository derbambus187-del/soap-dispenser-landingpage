const fs = require('fs');
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

let noImports = f
  .replace(/^import \{ writeFileSync, mkdirSync, existsSync \} from 'fs';$/m, 'const { writeFileSync, mkdirSync, existsSync } = require("fs");')
  .replace(/^import \{ join \} from 'path';$/m, 'const { join } = require("path");')
  .replace(/^import sharp from 'sharp';$/m, 'const sharp = { webp: () => ({ toFile: async () => {} }), resize: () => ({ webp: () => ({ toFile: async () => {} }) }) };');

const filtersStart = noImports.indexOf('const FILTERS = `');
const endBacktick = 12903; // Known position

const filtersCode = noImports.substring(filtersStart, endBacktick + 1);

fs.writeFileSync('/tmp/filters.cjs', filtersCode + '\nconsole.log("FILTERS length:", FILTERS.length);');

try {
  require('/tmp/filters.cjs');
  console.log('FILTERS parses OK');
} catch(e) {
  console.log('FILTERS error:', e.message);
}