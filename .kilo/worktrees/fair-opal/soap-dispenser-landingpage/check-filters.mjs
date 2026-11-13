const fs = require('fs');
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

const startIdx = f.indexOf('const FILTERS = `');
const endIdx = f.indexOf('`;', startIdx + 10);
const filtersContent = f.substring(startIdx, endIdx + 2);

const backticks = (filtersContent.match(/`/g) || []).length;
console.log('Backticks in FILTERS:', backticks);

const interpolations = (filtersContent.match(/\$\{/g) || []).length;
console.log('Interpolations:', interpolations);