import fs from 'fs';
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

// Remove imports and test parsing
let noImports = f
  .replace(/^import \{ writeFileSync, mkdirSync, existsSync \} from 'fs';$/m, 'const { writeFileSync, mkdirSync, existsSync } = require("fs");')
  .replace(/^import \{ join \} from 'path';$/m, 'const { join } = require("path");')
  .replace(/^import sharp from 'sharp';$/m, 'const sharp = require("sharp");');

const filtersStart = noImports.indexOf('const FILTERS = `');
const part1 = noImports.substring(0, filtersStart);

fs.writeFileSync('/tmp/part1.mjs', part1);

try {
  await import('/tmp/part1.mjs');
  console.log('Part 1 parses OK');
} catch(e) {
  console.log('Part 1 error:', e.message);
}