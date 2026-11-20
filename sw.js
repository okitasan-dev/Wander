/* Wander's offline helper. It keeps the app and what it has loaded, so reopening is instant and pages you have
   seen still open without a signal.
   - Wander's own files: always asked fresh from the server (so updates arrive together), cached copy if offline.
   - Place data (Wikipedia, Wikidata, OpenStreetMap, Commons): fresh when the network answers within a few
     seconds, otherwise the copy kept from last time.
   - Libraries, fonts, map tiles (street, satellite, terrain) and photos: kept copy first, since they rarely change. */
const APP = 'wander-app-v3.20.0', DATA = 'wander-data-v1', STATIC = 'wander-static-v1', TILES = 'wander-tiles-v1', IMAGES = 'wander-img-v1';
const KEEP = [APP, DATA, STATIC, TILES, IMAGES];
const SHELL = ['./', 'index.html', 'place.html', 'common.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const LIMITS = {[DATA]: 400, [TILES]: 600, [IMAGES]: 150};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('wander-') && !KEEP.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

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
  const c = await caches.match(req, {cacheName: name}); if(c) return c;
  const res = await fetch(req); if(res.ok || res.type === 'opaque') put(name, req, res.clone()); return res;
}

self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url), host = url.hostname;
  const geoTile = host === 'tiles.macrostrat.org' || (host === 'gbank.gsj.jp' && url.pathname.includes('/tiles/')) || /^GetMap$/i.test(url.searchParams.get('REQUEST') || '');
  if(url.origin === location.origin){
    e.respondWith(networkFirst(APP, req, {ignoreSearch: url.pathname.endsWith('place.html'), init: {cache: 'no-cache'}}));
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
