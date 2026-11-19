// Minimal static server for the repo on http://localhost:<port>. Use it rather than file:// when a test needs real
// network answers: several services refuse requests from a page with no origin (file://), and service workers need http.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('./paths').ROOT;
const TYPES = {'.html':'text/html', '.js':'application/javascript', '.png':'image/png', '.webmanifest':'application/manifest+json', '.json':'application/json'};
module.exports = port => new Promise(res => {
  const srv = http.createServer((req, resp) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if(p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p));
    if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ resp.writeHead(404); return resp.end('not found'); }
    resp.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600'});
    fs.createReadStream(f).pipe(resp);
  }).listen(port, () => res(srv));
});
