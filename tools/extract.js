// Extract the gzip+base64 JS modules from a 1980D bundled HTML file.
// Usage: node tools/extract.js <input.html> <outputDir>
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [, , htmlPath, outDir] = process.argv;
if (!htmlPath || !outDir) {
  console.error('Usage: node tools/extract.js <input.html> <outputDir>');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const data = fs.readFileSync(htmlPath, 'utf8');

const re = /"([a-f0-9-]{36})":\{"mime":"([^"]+)","compressed":true,"data":"([A-Za-z0-9+/=]+)"/g;
let m;
while ((m = re.exec(data)) !== null) {
  const [, uuid, mime, b64] = m;
  try {
    const out = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
    const ext = mime.includes('jsx') ? 'jsx' : 'js';
    fs.writeFileSync(path.join(outDir, uuid + '.' + ext), out);
    console.log('wrote', uuid + '.' + ext, out.length, mime);
  } catch (e) {
    console.log('err', uuid, e.message);
  }
}
