const fs = require('fs');
let f = fs.readFileSync('scripts/generate-images.mjs', 'utf8');

// Replace the & character in the replace call with the 5-char entity string
let count = 0;
while (true) {
  const idx = f.indexOf('.replace(/&/g,');
  if (idx === -1) break;
  const quoteIdx = f.indexOf("'&'", idx);
  if (quoteIdx === -1) break;
  f = f.substring(0, quoteIdx + 1) + " + 'amp;'" + f.substring(quoteIdx + 3);
  count++;
}
console.log('Replaced:', count);
fs.writeFileSync('scripts/generate-images.mjs', f, 'utf8');