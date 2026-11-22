// Offline and weak-signal opening (home-screen app). The service worker is on here (other tests block it).
// - First visit saves the app, the map library and the fonts; Settings → App says "saved for offline".
// - A server that takes 20 s to answer (one bar of signal) no longer gives a white screen: the app opens from its copy.
// - No connection at all: the app opens with its map.
// - A new version downloads in the background: the running page stays as it is, Settings offers "ready · Reload",
//   and the reload (like the next open) runs the new version.
// - A half-published version (common.js not updated yet) is refused, and the working copy is kept.
// - No saved copy and no signal: a "No signal" page rather than a blank one.
const {OUT, ROOT} = require('./paths');
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const BASE = fs.readFileSync(path.join(ROOT, 'common.js'), 'utf8').match(/WANDER_VERSION = '([\d.]+)'/)[1];
const NEXT = BASE.replace(/\d+$/, n => +n + 1);
const S = {slow: false, down: false, version: BASE, staleJs: false};
const TYPES = {'.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json'};
const srv = http.createServer((req, res) => {
  if(S.down) return req.socket.destroy();   // no connection (Playwright's offline switch doesn't reach the service worker)
  const send = () => {
    let p = new URL(req.url, 'http://x').pathname; if(p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, path.normalize(p));
    if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end(); }
    const ext = path.extname(f); res.writeHead(200, {'content-type': TYPES[ext] || 'application/octet-stream'});
    if(!['.html', '.js'].includes(ext)) return fs.createReadStream(f).pipe(res);
    let t = fs.readFileSync(f, 'utf8');   // "publish" another version by rewriting the version strings
    if(!(S.staleJs && p.endsWith('common.js'))) t = t.split(BASE).join(S.version);
    res.end(t);
  };
  S.slow ? setTimeout(send, 20000) : send();
});
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});

(async () => {
  await new Promise(r => srv.listen(0, r)); const URL0 = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, geolocation: {latitude: 34.18172, longitude: -118.31143}, permissions: ['geolocation']});
  // Data services answer emptily (requests made by the service worker go past this and fail quietly: fine here)
  await ctx.route(/^https?:\/\/(?!localhost|cdnjs|fonts)/, r => { const h = new URL(r.request().url()).hostname;
    if(h === 'nominatim.openstreetmap.org') return J(r, {address: {suburb: 'Magnolia Park', city: 'Burbank', country_code: 'us'}});
    if(h === 'query.wikidata.org') return J(r, {results: {bindings: []}});
    if(/tile|arcgisonline/.test(h)) return r.fulfill({status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'icons/icon-192.png'))});
    return r.abort(); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  const state = () => pg.evaluate(() => ({ver: document.getElementById('ver')?.textContent, app: document.getElementById('appVer')?.textContent,
    reload: !!document.getElementById('appReload') && !document.getElementById('appReload').hidden, leaflet: typeof L, map: !!document.querySelector('.leaflet-container'),
    font: document.fonts.check('16px "Schibsted Grotesk"'), text: document.body.innerText.length}));
  const caches = () => pg.evaluate(async () => { const o = {}; for(const k of await window.caches.keys()) o[k] = (await (await window.caches.open(k)).keys()).map(r => r.url.replace(location.origin, '')); return o; });

  // 1. First visit, online
  await pg.goto(URL0); await pg.waitForFunction(() => navigator.serviceWorker.controller, null, {timeout: 20000});
  await pg.waitForTimeout(1500);
  let c = await caches(), st = await state();
  console.log('first visit:', JSON.stringify(st)); console.log('saved:', Object.entries(c).map(([k, v]) => k + ' ' + v.length).join(', '));
  ok('the app files are saved', ['/', '/index.html', '/place.html', '/common.js'].every(u => (c['wander-app-v' + BASE] || []).includes(u)));
  ok('the map library is saved on the first visit', (c['wander-static-v1'] || []).filter(u => /leaflet\.min\.(js|css)$/.test(u)).length === 2);
  ok('the fonts are saved on the first visit', (c['wander-static-v1'] || []).some(u => u.includes('fonts.gstatic.com')));
  ok('Settings → App: version, saved for offline', st.app === `Version ${BASE} · saved for offline` && !st.reload);

  // 2. One bar of signal: the server takes 20 s
  S.slow = true; let t = Date.now();
  pg.goto(URL0, {timeout: 0}).catch(() => {});
  await pg.waitForFunction(() => document.querySelector('.leaflet-container') && document.body.innerText.length > 50, null, {timeout: 8000}).catch(() => {});
  st = await state(); console.log(`slow server: drawn after ${Date.now() - t} ms`, JSON.stringify(st));
  ok('slow connection: the app opens within 3 s, map and all', Date.now() - t < 3000 && st.map && st.leaflet === 'object');
  S.slow = false; await pg.screenshot({path: OUT + '/offline-slow.png'});

  // 3. No connection at all
  await ctx.setOffline(true); S.down = true; t = Date.now();
  await pg.goto(URL0).catch(() => {}); await pg.waitForSelector('.leaflet-container', {timeout: 5000}).catch(() => {});
  st = await state(); console.log('offline:', JSON.stringify(st));
  ok('offline: the app opens with its map and fonts', st.map && st.leaflet === 'object' && st.font && st.ver === 'Wander ' + BASE);
  await pg.goto(URL0 + 'place.html?id=Q42&lang=en').catch(() => {}); await pg.waitForTimeout(800);
  ok('offline: the place page opens too', await pg.evaluate(() => document.body.innerText.length > 20 && !!document.querySelector('script[src^="common.js"]')));
  await pg.screenshot({path: OUT + '/offline-place.png'});
  await ctx.setOffline(false); S.down = false; await pg.goto(URL0); await pg.waitForTimeout(800);

  // 4. A half-published version (new sw.js, old common.js still served): refused, the working copy stays
  S.version = NEXT; S.staleJs = true;
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()).catch(() => {})); await pg.waitForTimeout(2500);
  c = await caches(); st = await state();
  console.log('half-published:', Object.keys(c).join(', '), JSON.stringify(st));
  ok('half-published version refused: the working copy is kept', !!c['wander-app-v' + BASE] && !c['wander-app-v' + NEXT] && !st.reload);

  // 5. A whole new version: downloads in the background; Settings offers Reload; the page keeps running as it is
  S.staleJs = false;
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())); await pg.waitForTimeout(2500);
  c = await caches(); st = await state();
  console.log('new version saved:', Object.keys(c).join(', '), JSON.stringify(st));
  ok('the new version is saved and the old copy removed', !!c['wander-app-v' + NEXT] && !c['wander-app-v' + BASE]);
  ok('the running page is untouched (old version still shown)', st.ver === 'Wander ' + BASE);
  ok(`Settings → App: "Version ${NEXT} is ready" with Reload`, st.app === `Version ${NEXT} is ready` && st.reload);
  await pg.evaluate(() => { document.getElementById('settings').open = true; }); await pg.waitForTimeout(300);
  await pg.locator('#appVer').scrollIntoViewIfNeeded(); await pg.screenshot({path: OUT + '/offline-update-ready.png'});
  await ctx.setOffline(true); S.down = true;   // the reload works with no signal too: the new version is already on the phone
  await Promise.all([pg.waitForNavigation().catch(() => {}), pg.click('#appReload')]); await pg.waitForTimeout(1500);
  st = await state(); console.log('after Reload (offline):', JSON.stringify(st));
  ok('Reload runs the new version, offline', st.ver === 'Wander ' + NEXT && st.app === `Version ${NEXT} · saved for offline` && !st.reload);

  // 6. Nothing saved and no signal: a "No signal" page, not a blank one
  await pg.evaluate(async () => { for(const k of await caches.keys()) await caches.delete(k); });
  await pg.goto(URL0 + 'index.html?never-saved').catch(() => {}); await pg.waitForTimeout(500);
  const txt = await pg.evaluate(() => document.body.innerText).catch(e => 'ERR ' + e.message); console.log('page:', JSON.stringify(txt.slice(0, 200)), pg.url());
  ok('no saved copy, no signal: "No signal" page', /No signal/.test(txt) && /opened once with a connection/.test(txt));
  await pg.screenshot({path: OUT + '/offline-not-saved.png'});

  console.log('errors', errs); await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
