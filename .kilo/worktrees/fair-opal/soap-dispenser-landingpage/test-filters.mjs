import fs from 'fs';
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

const startIdx = f.indexOf('const FILTERS = `');
const endBacktick = 12903;
const filtersCode = f.substring(startIdx, endBacktick + 1);

// Write to temp file and import
fs.writeFileSync('/tmp/test-filters.mjs', filtersCode + '\nexport { FILTERS };');

import('/tmp/test-filters.mjs').then(m => {
  console.log('FILTERS parsed OK, length:', m.FILTERS.length);
}).catch(e => {
  console.log('Parse error:', e.message);
});