import fs from 'fs';
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

const startIdx = f.indexOf('const FILTERS = `');
const endBacktick = 12903;
const filtersContent = f.substring(startIdx + 18, endBacktick);

let pos = 0;
let found = false;
while (true) {
  const idx = filtersContent.indexOf('${', pos);
  if (idx === -1) break;
  console.log('${ at:', idx, 'Context:', JSON.stringify(filtersContent.substring(Math.max(0, idx-30), idx+60)));
  found = true;
  pos = idx + 1;
}
if (!found) console.log('No ${ in FILTERS');

pos = 0;
while (true) {
  const idx = filtersContent.indexOf('}', pos);
  if (idx === -1) break;
  if (idx > 0 && filtersContent[idx-1] !== '$' && filtersContent[idx-1] !== '\\') {
    console.log('Lone } at:', idx, 'Context:', JSON.stringify(filtersContent.substring(Math.max(0, idx-30), idx+30)));
  }
  pos = idx + 1;
}