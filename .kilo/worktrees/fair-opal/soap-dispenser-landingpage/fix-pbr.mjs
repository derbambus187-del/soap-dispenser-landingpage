const fs = require('fs');
let f = fs.readFileSync('scripts/generate-pbr.mjs', 'utf8');

let count = 0;
let pos = 0;
while (true) {
  const idx = f.indexOf('.replace(/&/g,', pos);
  if (idx === -1) break;
  const quoteIdx = f.indexOf('"&"', idx);
  if (quoteIdx === -1) break;
  f = f.substring(0, quoteIdx + 1) + " + 'amp;'" + f.substring(quoteIdx + 3);
  count++;
  pos = quoteIdx + 10;
}
console.log('Fixed:', count);

fs.writeFileSync('scripts/generate-pbr.mjs', f, 'utf8');