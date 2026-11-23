/* Wander's offline helper. It keeps the app and what it has loaded, so the app always opens (even with one bar of
   signal) and pages you have seen still open without a signal.
   - Wander's own files: kept copy first, so the layout never waits on the network. Each version is downloaded whole
     when it's published (a new APP name below makes the phone fetch it); the old copy is deleted only once the new one
     is complete, and the switch shows on the next open (Settings offers a Reload sooner).
   - Place data (Wikipedia, Wikidata, OpenStreetMap, Commons): fresh when the network answers within a few
     seconds, otherwise the copy kept from last time.
   - Libraries, fonts, map tiles (street, satellite, terrain) and photos: kept copy first, since they rarely change.
     The map library and fonts are saved with the app, so the first visit is enough. */
const APP = 'wander-app-v3.24.1', DATA = 'wander-data-v1', STATIC = 'wander-static-v1', TILES = 'wander-tiles-v1', IMAGES = 'wander-img-v1';
const VERSION = APP.replace('wander-app-v', '');
const KEEP = [APP, DATA, STATIC, TILES, IMAGES];
const SHELL = ['./', 'index.html', 'place.html', 'common.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
// Loaded by the pages before they can draw: saved with the app. Leaflet is needed; the fonts only look nicer.
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];
const FONTS = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700&family=Schibsted+Grotesk:wght@400;500;600&display=swap';
const LIMITS = {[DATA]: 400, [TILES]: 600, [IMAGES]: 150};

async function saveOnce(cache, url){
  if(await cache.match(url, {ignoreVary: true})) return;
  const res = await fetch(url, {cache: 'reload'});
  if(!res.ok) throw new Error(url + ' ' + res.status);
  await cache.put(url, res.clone());
  return res;
}
async function saveFonts(cache){
  const res = await saveOnce(cache, FONTS); if(!res) return;
  const files = [...(await res.text()).matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(files.map(u => saveOnce(cache, u).catch(() => {})));
}
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    // Fetch this version's files past every cache (?v= gets past GitHub's 10-minute server cache), check they really
    // are this version, and only then save them. Any failure stops the install, so the old version stays in place and
    // the phone tries again later, rather than deleting a working copy for a half-downloaded one.
    const got = await Promise.all(SHELL.map(async u => {
      const res = await fetch(new Request(u + (u.includes('?') ? '&' : '?') + 'v=' + VERSION, {cache: 'reload'}));
      if(!res.ok) throw new Error(u + ' ' + res.status);
      return [u, res];
    }));
    const js = await got.find(([u]) => u === 'common.js')[1].clone().text();
    if(!js.includes(`WANDER_VERSION = '${VERSION}'`)) throw new Error('common.js is not version ' + VERSION + ' yet');
    const app = await caches.open(APP);
    await Promise.all(got.map(([u, res]) => app.put(u, res)));
    const lib = await caches.open(STATIC);
    await Promise.all(LIBS.map(u => saveOnce(lib, u)));
    await saveFonts(lib).catch(() => {});
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('wander-') && !KEEP.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll()).then(cs => cs.forEach(c => c.postMessage({wanderVersion: VERSION}))));
});
// A page asks which version is saved (Settings shows "ready · Reload" when it's newer than the one running)
self.addEventListener('message', e => { if(e.data === 'wander-version' && e.source) e.source.postMessage({wanderVersion: VERSION}); });

async function trim(name){
  const c = await caches.open(name), keys = await c.keys(), max = LIMITS[name];
  if(max && keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => c.delete(k)));
}
async function put(name, req, res){
  try{ const c = await caches.open(name); await c.put(req, res); trim(name); }catch(e){ /* storage full or response not storable: skip */ }
}
async function networkFirst(name, req, opts = {}){
  const cached = () => caches.match(req, {ignoreSearch: !!opts.ignoreSearch, cacheName: name});
  const net = fetch(req, opts.init).then(res => { if(res.ok) put(name, req, res.clone()); return res; });
  if(!opts.timeout) return net.catch(async e => (await cached()) || (await caches.match(req, {ignoreSearch: true})) || Promise.reject(e));
  // Slow network: answer from the kept copy after a few seconds, but let the fresh answer refresh the cache
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(async () => { const c = await cached(); if(c && !done){ done = true; resolve(c); } }, opts.timeout);
    net.then(res => { clearTimeout(timer); if(!done){ done = true; resolve(res); } })
       .catch(async () => { clearTimeout(timer); if(!done){ done = true; resolve((await cached()) || Response.error()); } });
  });
}
async function cacheFirst(name, req){
  const c = await caches.match(req, {cacheName: name, ignoreVary: true}); if(c) return c;
  const res = await fetch(req); if(res.ok || res.type === 'opaque') put(name, req, res.clone()); return res;
}
// Shown only if a page is opened with no signal before the app was ever saved (instead of a blank white screen)
const NOT_SAVED = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wander</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#E6E9E4;color:#132A2C;
font:17px/1.5 -apple-system,system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
@media (prefers-color-scheme:dark){body{background:#0C2123;color:#E8EEE7}}button{font:inherit;margin-top:14px;padding:10px 22px;
border-radius:12px;border:0;background:#8A672B;color:#FFF9EC}</style>
<div><h1 style="font-size:24px;margin:0 0 8px">No signal</h1><p style="margin:0">Wander needs to be opened once with a connection<br>before it can work offline.</p>
<button onclick="location.reload()">Try again</button></div>`;
async function appFile(req){
  // Kept copy first (ignoring ?v= and place.html's ?id=); network only for files not saved with the app
  const c = await caches.match(req, {cacheName: APP, ignoreSearch: true}); if(c) return c;
  try{
    const res = await fetch(req);
    if(res.ok && !new URL(req.url).pathname.endsWith('sw.js')) put(APP, req, res.clone());
    return res;
  }catch(e){
    const any = await caches.match(req, {ignoreSearch: true}); if(any) return any;
    if(req.mode === 'navigate') return new Response(NOT_SAVED, {headers: {'content-type': 'text/html; charset=utf-8'}});
    throw e;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url), host = url.hostname;
  const geoTile = host === 'tiles.macrostrat.org' || (host === 'gbank.gsj.jp' && url.pathname.includes('/tiles/')) || /^GetMap$/i.test(url.searchParams.get('REQUEST') || '');
  if(url.origin === location.origin){
    e.respondWith(appFile(req));
  } else if(geoTile){
    e.respondWith(cacheFirst(TILES, req));   // geologic map tiles, like any map tile
  } else if(/(^|\.)(wikipedia|wikidata)\.org$|^commons\.wikimedia\.org$|^nominatim\.openstreetmap\.org$|overpass|^(macrostrat\.org|api\.inaturalist\.org|api\.open-meteo\.com|gbank\.gsj\.jp|map\.bgs\.ac\.uk|services\.ga\.gov\.au|earthquake\.usgs\.gov|rest\.isric\.org|archive-api\.open-meteo\.com|hydro\.nationalmap\.gov|api\.gbif\.org|services-eu1\.arcgis\.com|services2\.arcgis\.com|inspire\.hes\.scot)$/.test(host) || /\.wikivoyage\.org$/.test(host)){
    e.respondWith(networkFirst(DATA, req, {timeout: 6000}));
  } else if(/^(upload|thumb)\.wikimedia\.org$/.test(host)){
    e.respondWith(cacheFirst(IMAGES, req));
  } else if(/^(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|server\.arcgisonline\.com)$/.test(host)){
    e.respondWith(cacheFirst(TILES, req));
  } else if(/^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(host)){
    e.respondWith(cacheFirst(STATIC, req));
  }
});
