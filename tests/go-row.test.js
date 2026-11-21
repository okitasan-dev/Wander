// The Go box: under the welcome title before there is a position, then a field starting the row under the map, before the
// Types and Sources icons.
// Typing widens it over the row; tapping Go searches, empties it and puts Types and Sources back. Settings no longer has one.
const {OUT} = require('./paths');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, serviceWorkers: 'block'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname;
    if(/cdnjs|fonts/.test(h)) return r.continue();
    if(h === 'nominatim.openstreetmap.org') return u.pathname === '/search'
      ? J(r, [{lat: '35.0037', lon: '135.7788', display_name: 'Gion, Kyoto'}])
      : J(r, {name: 'X', addresstype: 'suburb', address: +u.searchParams.get('lat') > 30 && +u.searchParams.get('lon') > 0 ? {suburb: 'Gion', city: 'Kyoto', country: 'Japan', country_code: 'jp'} : {suburb: 'Magnolia Park', city: 'Burbank', country: 'United States', country_code: 'us'}, extratags: {}});
    if(h === 'query.wikidata.org') return J(r, {results: {bindings: []}});
    return r.abort(); });
  await pg.goto('file://' + require('path').resolve(__dirname, '..') + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };
  const where = () => pg.evaluate(() => { const f = document.querySelector('#placeForm'), r = f.getBoundingClientRect();
    return {in: f.parentElement.id || f.parentElement.className, visible: r.width > 0 && r.height > 0, w: Math.round(r.width)}; });

  let w = await where(); console.log('no position yet:', JSON.stringify(w));
  ok('before a position: the Go box sits under the title, full width', w.in === 'goSlot' && w.visible && w.w > 300);
  await pg.screenshot({path: OUT + '/go-row-start.png'});
  ok('Settings has no Go box any more', await pg.evaluate(() => !document.querySelector('#settings #placeForm, #settings #placeInput')));

  await pg.evaluate(() => setManual(34.18172, -118.31143)); await pg.waitForTimeout(1500);
  w = await where(); console.log('with a map:', JSON.stringify(w));
  const row = await pg.evaluate(() => { const lg = document.querySelector('.legend'), box = lg.getBoundingClientRect();
    const parts = ['#placeInput', '#placeForm button', '.lg-catbtn', '.lg-srcbtn'].map(s => document.querySelector(s).getBoundingClientRect());
    return {oneLine: new Set(parts.map(p => Math.round(p.top + p.height / 2))).size === 1, inside: parts.every(p => p.left >= 0 && p.right <= innerWidth), order: parts.every((p, i) => !i || p.left >= parts[i - 1].right - 1), field: Math.round(parts[0].width), scrollX: document.documentElement.scrollWidth > innerWidth}; });
  console.log('row:', JSON.stringify(row));
  ok('with a map: the Go box starts the row, then the Types and Sources icons, all on one line inside the screen', w.in === 'legend' && row.oneLine && row.inside && row.order && !row.scrollX && row.field >= 180);
  ok('Types and Sources are icons, named for screen readers', await pg.evaluate(() => ['.lg-catbtn', '.lg-srcbtn'].every(s => { const b = document.querySelector(s); return b.getBoundingClientRect().width <= 40 && b.getAttribute('aria-label'); })));
  ok('no "You" in the row', await pg.evaluate(() => !document.querySelector('.legend').textContent.includes('You')));
  const clip = async () => { const r = await pg.$eval('.legend', e => { const x = e.getBoundingClientRect(); return {y: x.y + scrollY}; }); return {x: 0, y: r.y - 70, width: 390, height: 140}; };
  await pg.evaluate(() => document.querySelector('.legend').scrollIntoView({block: 'center'})); await pg.waitForTimeout(200);
  await pg.screenshot({path: OUT + '/go-row.png', clip: await clip(), fullPage: true});

  await pg.click('#placeInput'); await pg.keyboard.type('Gion Kyoto');
  const typing = await pg.evaluate(() => ({field: Math.round(document.querySelector('#placeInput').getBoundingClientRect().width), btnRight: Math.round(document.querySelector('#placeForm button').getBoundingClientRect().right), types: getComputedStyle(document.querySelector('.lg-catbtn')).display}));
  console.log('typing:', JSON.stringify(typing));
  ok('typing: the field widens over the row (Types and Sources step aside), the arrow stays on screen', typing.types === 'none' && typing.field > row.field + 60 && typing.btnRight <= 390 - 8);
  await pg.screenshot({path: OUT + '/go-row-typing.png', clip: await clip(), fullPage: true});
  await pg.click('#placeForm button'); await pg.waitForTimeout(2500);
  const after = await pg.evaluate(() => ({pos: [+state.pos.lat.toFixed(4), +state.pos.lon.toFixed(4)], value: document.querySelector('#placeInput').value, types: getComputedStyle(document.querySelector('.lg-catbtn')).display, explore: document.querySelector('#explore').textContent}));
  console.log('after Go:', JSON.stringify(after));
  ok('tapping Go searches there, empties the field and brings Types back', after.pos[0] === 35.0037 && after.value === '' && after.types !== 'none' && /Gion/.test(after.explore));
  await pg.click('.lg-catbtn'); await pg.waitForTimeout(200);
  ok('Types still opens its menu', await pg.evaluate(() => !document.querySelector('#catMenu').hidden));
  console.log(fails ? 'FAIL' : 'PASS'); console.log('errors', errs); await b.close(); process.exit(fails ? 1 : 0);
})();
