// Re-inject edited JS modules back into a 1980D bundled HTML file.
// For every <uuid>.js / <uuid>.jsx file in <moduleDir>, gzip+base64 it and
// replace that uuid's "data" field in the HTML manifest. Only the data field
// is touched; everything else in the file is preserved byte-for-byte.
// Usage: node tools/repack.js <input.html> <moduleDir> <output.html>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [, , htmlPath, moduleDir, outPath] = process.argv;
if (!htmlPath || !moduleDir || !outPath) {
  console.error('Usage: node tools/repack.js <input.html> <moduleDir> <output.html>');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');
const files = fs.readdirSync(moduleDir).filter(f => /^[a-f0-9-]{36}\.(js|jsx)$/.test(f));
if (!files.length) { console.error('No <uuid>.js/.jsx files found in', moduleDir); process.exit(1); }

for (const file of files) {
  const uuid = file.replace(/\.(js|jsx)$/, '');
  const marker = '"' + uuid + '":{"mime":';
  // A uuid can appear in more than one manifest (dark/light share libs); patch every occurrence.
  let idx = 0, patched = 0;
  const src = fs.readFileSync(path.join(moduleDir, file), 'utf8');
  const b64 = zlib.gzipSync(Buffer.from(src, 'utf8')).toString('base64');
  while ((idx = html.indexOf(marker, idx)) !== -1) {
    const dataKeyIdx = html.indexOf('"data":"', idx);
    const dataStart = dataKeyIdx + '"data":"'.length;
    const dataEnd = html.indexOf('"', dataStart);
    html = html.slice(0, dataStart) + b64 + html.slice(dataEnd);
    idx = dataStart + b64.length;
    patched++;
  }
  console.log(uuid, patched ? `patched ${patched} occurrence(s), b64 len ${b64.length}` : 'NOT FOUND in html');
}

fs.writeFileSync(outPath, html, 'utf8');
console.log('wrote', outPath, html.length, 'bytes');
