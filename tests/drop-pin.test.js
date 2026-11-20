// Long-press (right-click here) on the map drops a pin; "Look around here" searches that spot; closing the popup removes the pin.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname, sp = u.searchParams;
    if(/cdnjs|fonts/.test(h)) return r.continue();
    if(/tile\.openstreetmap/.test(h)) return r.fulfill({status: 200, contentType: 'image/png', body: require('fs').readFileSync(require('path').join(__dirname, 'fixtures', require('fs').readdirSync(require('path').join(__dirname, 'fixtures')).find(f => /\.png$/.test(f))))});
    if(h === 'nominatim.openstreetmap.org'){ const east = +sp.get('lon') > -118.31; return J(r, {name: east ? 'Toluca Lake' : 'Magnolia Park', addresstype: 'suburb', osm_type: 'way', osm_id: east ? 2 : 1,
      address: {suburb: east ? 'Toluca Lake' : 'Magnolia Park', city: 'Los Angeles', country: 'United States', country_code: 'us'}, extratags: {}}); }
    if(h === 'query.wikidata.org') return J(r, {results: {bindings: []}});
    if(/wikipedia\.org$/.test(h)) return J(r, {query: {pages: []}});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  await pg.evaluate(() => setManual(34.18172, -118.31143)); await pg.waitForTimeout(2500);
  const box = await pg.$eval('#map', e => { const r = e.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; });
  const at = {x: box.x + box.w * .8, y: box.y + box.h * .35};

  // drop, then close: the pin goes away and nothing is searched
  await pg.mouse.click(at.x, at.y, {button: 'right'}); await pg.waitForTimeout(300);
  let s = await pg.evaluate(() => ({pin: !!M.drop, popup: document.querySelector('.leaflet-popup-content')?.innerText}));
  console.log('dropped:', JSON.stringify(s));
  ok('long press drops a pin with a Look around here button', s.pin && /Dropped pin/.test(s.popup) && /from you|from the spot/.test(s.popup) && /Look around here/.test(s.popup));
  await pg.screenshot({path: OUT + '/drop-pin.png', clip: {x: 0, y: box.y, width: 390, height: box.h}});
  await pg.click('.leaflet-popup-close-button'); await pg.waitForTimeout(200);
  ok('closing the popup removes the pin and stays put', await pg.evaluate(() => !M.drop && !document.querySelector('.drop-pin') && Math.abs(state.pos.lon + 118.31143) < 1e-6));

  // drop again and look around there
  await pg.mouse.click(at.x, at.y, {button: 'right'}); await pg.waitForTimeout(300);
  const ll = await pg.evaluate(() => M.drop.getLatLng());
  await pg.click('.lookhere'); await pg.waitForTimeout(3000);
  s = await pg.evaluate(() => ({pos: state.pos, manual: state.manual, place: state.place, pin: !!document.querySelector('.drop-pin'),
    centre: M.map.getCenter(), lib: JSON.parse(localStorage.getItem('wander.places') || '[]').map(e => e.name + ' [' + e.kinds + ']')}));
  console.log('looked:', JSON.stringify(s));
  ok('searches the pin\'s spot', Math.abs(s.pos.lat - ll.lat) < 1e-6 && Math.abs(s.pos.lon - ll.lng) < 1e-6 && s.manual && /Toluca Lake/.test(s.place));
  ok('map moves there and the pin is gone', Math.abs(s.centre.lng - ll.lng) < .002 && !s.pin);
  ok('Places library records it as searched', s.lib.some(x => /Toluca Lake.*searched/.test(x)));
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
