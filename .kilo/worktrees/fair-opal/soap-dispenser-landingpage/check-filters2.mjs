import fs from 'fs';
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

const startIdx = f.indexOf('const FILTERS = `');
const endIdx = f.indexOf('`;', startIdx + 10);
const filtersContent = f.substring(startIdx, endIdx + 2);

const innerContent = filtersContent.substring(18, filtersContent.length - 2);
let pos = 0;
let found = false;
while (true) {
  const idx = innerContent.indexOf('${', pos);
  if (idx === -1) break;
  console.log('${ at:', idx, 'Context:', JSON.stringify(innerContent.substring(Math.max(0, idx-30), idx+50)));
  found = true;
  pos = idx + 1;
}
if (!found) console.log('No ${ interpolations in FILTERS');