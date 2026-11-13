const fs = require('fs');
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

// Remove imports and test parsing
let noImports = f
  .replace(/^import \{ writeFileSync, mkdirSync, existsSync \} from 'fs';$/m, 'const { writeFileSync, mkdirSync, existsSync } = require("fs");')
  .replace(/^import \{ join \} from 'path';$/m, 'const { join } = require("path");')
  .replace(/^import sharp from 'sharp';$/m, 'const sharp = { webp: () => ({ toFile: async () => {} }), resize: () => ({ webp: () => ({ toFile: async () => {} }) }) };');

const filtersStart = noImports.indexOf('const FILTERS = `');
const part1 = noImports.substring(0, filtersStart);

fs.writeFileSync('/tmp/part1.cjs', part1);

try {
  require('/tmp/part1.cjs');
  console.log('Part 1 parses OK');
} catch(e) {
  console.log('Part 1 error:', e.message);
}