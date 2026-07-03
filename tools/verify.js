// Verify every compressed module in a 1980D bundled HTML file still
// gunzips cleanly. Run after any repack, before installing over beta.html.
// Usage: node tools/verify.js <file.html>
const fs = require('fs');
const zlib = require('zlib');

const htmlPath = process.argv[2];
if (!htmlPath) { console.error('Usage: node tools/verify.js <file.html>'); process.exit(1); }
const data = fs.readFileSync(htmlPath, 'utf8');

const re = /"([a-f0-9-]{36})":\{"mime":"([^"]+)","compressed":true,"data":"([A-Za-z0-9+/=]+)"/g;
let m, count = 0, ok = 0;
while ((m = re.exec(data)) !== null) {
  count++;
  try { zlib.gunzipSync(Buffer.from(m[3], 'base64')); ok++; }
  catch (e) { console.log('GUNZIP FAIL', m[1], e.message); }
}
console.log('blobs:', count, 'ok:', ok);
process.exit(count === ok && count > 0 ? 0 : 1);
