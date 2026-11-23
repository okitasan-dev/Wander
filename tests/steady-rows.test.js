// Photos stay put while more data arrives (Nature's land card, live iNaturalist near Griffith Park).
// Each redraw used to rebuild the card, so every photo reloaded (a flash) and sideways rows jumped back to the first
// tile. Now a redraw only changes what's different:
// - plain redraws keep the same photo elements (no reload) and a sideways row's scroll position (the row with the most
//   photos, usually Life);
// - a new section arriving above it (Birds lately, simulated eBird) doesn't disturb that row either;
// - a group chip row the reader scrolled stays where it is;
// - list cards keep their photo elements when they reorder (walking changes the distances).
const {OUT, FIX} = require('./paths');
const fs = require('fs');
const {chromium} = require('playwright');
const J = (r, body) => r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
(async () => {
  const srv = await require('./serve.js')(8781); const b = await chromium.launch();
  const ctx = await b.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'}); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let nPhoto = 0;
  await pg.route(/^https?:\/\//, r => { const u = new URL(r.request().url()), h = u.hostname;
    // photos: stand-ins (the photo hosts often refuse the sandbox); species lists stay live
    if(/inaturalist-open-data|static\.inaturalist|amazonaws/.test(h)) return r.fulfill({status: 200, contentType: 'image/jpeg', body: fs.readFileSync(FIX + '/sp' + (nPhoto++ % 6) + '.jpg')});
    if(/localhost|cdnjs|fonts|query\.wikidata\.org|tile\.openstreetmap|nominatim|api\.inaturalist/.test(h)) return r.continue();
    if(h === 'www.wikidata.org') return J(r, {entities: {}}); if(/wikipedia/.test(h)) return J(r, {query: {pages: []}}); if(/overpass/.test(h)) return J(r, {elements: []});
    return J(r, {}); });
  await pg.goto('http://localhost:8781/index.html'); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('wander.mode', '"nature"'); }); await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(() => setManual(34.1366, -118.2942));
  await pg.waitForFunction(() => state.nature && !state.nature.loading, null, {timeout: 90000}); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { state.expanded.add('nature'); render(); });
  await pg.waitForTimeout(2500);
  let fails = 0; const ok = (t, c) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if(!c) fails++; };

  // The sideways row with the most photos (Life, In season…: live data varies): scroll it and tag its photos, so a
  // rebuilt element would show up as untagged
  const loaded = r => [...r.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth > 0).length;
  await pg.waitForFunction(loaded => [...document.querySelectorAll('#areaWrap .species:not(.short)')].some(r => eval(loaded)(r) >= 4), loaded.toString(), {timeout: 40000}).catch(() => {});
  const ready = await pg.evaluate(loaded => { loaded = eval(loaded); const rows = [...document.querySelectorAll('#areaWrap .species:not(.short)')];
    const row = rows.sort((a, b) => loaded(b) - loaded(a))[0]; if(!row || !loaded(row)) return null;
    window._testRow = row;   // a property, not an id: the redraw keeps the element but resets its attributes
    row.closest('.layer').querySelector('h4').scrollIntoView(); row.scrollLeft = 300;
    window._seenSrc = new Set(); document.querySelectorAll('#areaWrap img').forEach(i => { i._seen = true; window._seenSrc.add(i.getAttribute('src')); });
    return row.closest('.layer').querySelector('h4').textContent; }, loaded.toString());
  const life = () => pg.evaluate(() => { const row = window._testRow; if(!row || !row.isConnected) return null;
    const imgs = [...row.querySelectorAll('img')], was = window._seenSrc;
    const kept = imgs.filter(i => was.has(i.getAttribute('src')));   // photos that were already showing
    return {scroll: Math.round(row.scrollLeft), imgs: imgs.length, kept: kept.length, rebuilt: kept.filter(i => !i._seen).length}; });
  console.log('row under test:', ready);
  await pg.waitForTimeout(1200);   // the row scrolls smoothly (and snaps to a tile)
  ok('a sideways row with photos is there (live iNaturalist)', !!ready);
  let before = await life(); console.log('before:', JSON.stringify(before));

  // 1. Plain redraws, as when another answer arrives
  for(let i = 0; i < 4; i++){ await pg.evaluate(() => render()); await pg.waitForTimeout(200); }
  let after = await life(); console.log('after 4 redraws:', JSON.stringify(after));
  ok('redraws: the row keeps its scroll position', after && after.scroll === before.scroll && before.scroll > 0);
  ok('redraws: photos already shown stay the same elements (no flash)', after.kept > 0 && after.rebuilt === 0);
  const all = await pg.evaluate(() => { const was = window._seenSrc; const imgs = [...document.querySelectorAll('#areaWrap img')].filter(i => was.has(i.getAttribute('src')));
    return {kept: imgs.length, rebuilt: imgs.filter(i => !i._seen).length}; });
  console.log('whole card:', JSON.stringify(all));
  ok('redraws: no photo anywhere in the card is rebuilt', all.kept > 0 && all.rebuilt === 0);

  // 2. A new section arrives above Life (Birds lately)
  const yBefore = await pg.evaluate(() => scrollY);
  await pg.evaluate(() => { state.nature.ebird = {total: 2, km: 1, rare: [], spots: [], list: [
    {url: 'https://ebird.org/species/x1', common: 'Test warbler', sci: 'Testus one', when: 'today', count: 3},
    {url: 'https://ebird.org/species/x2', common: 'Test sparrow', sci: 'Testus two', when: 'yesterday', count: 5}]}; render(); });
  await pg.waitForTimeout(300);
  after = await life(); console.log('after Birds lately arrived:', JSON.stringify(after));
  ok('Birds lately shows', await pg.evaluate(() => [...document.querySelectorAll('.layer h4')].some(h => h.textContent === 'Birds lately')));
  ok('a section added above: the row keeps its scroll and photos', after.scroll === before.scroll && after.kept > 0 && after.rebuilt === 0);

  // 3. A group chip row the reader scrolled stays put
  const grp = await pg.evaluate(() => { const g = [...document.querySelectorAll('#areaWrap .grp')].find(x => x.scrollWidth > x.clientWidth + 20); if(!g) return null;
    g.scrollLeft = 60; render(); return Math.round(g.isConnected ? g.scrollLeft : -1); });
  console.log('group row after a redraw:', grp);
  ok('a scrolled group chip row stays where it was', grp === null || grp === 60);

  // 4. List cards reorder (walking): photos stay the same elements
  const list = await pg.evaluate(() => {
    const k = 'test:a', k2 = 'test:b', src = 'https://static.inaturalist.org/photos/1/square.jpg';
    const mk = (key, title, dlat) => ({key, src: 'OpenStreetMap', versions: {en: {title, extract: title + ' is a test place.', thumb: src}}, lat: state.pos.lat + dlat, lon: state.pos.lon, facts: [], tags: {natural: 'tree'}, factsLoaded: true, addedAt: Date.now()});
    state.items.set(k, mk(k, 'Test oak', .0005));
    state.items.set(k2, mk(k2, 'Test spring', .001));
    render(); const card = () => document.querySelector(`#listWrap article[data-key="${k}"]`), c1 = card(); if(!c1) return null; c1._seen = true;
    state.items.get(k).lat = state.pos.lat + .002; render();   // now farther than the other one
    const order = [...document.querySelectorAll('#listWrap article[data-key^="test:"]')].map(a => a.dataset.key);
    return {sameCard: card() === c1 && card()._seen === true, order};
  });
  console.log('list reorder:', JSON.stringify(list));
  ok('list cards reorder and keep their elements', list && list.sameCard && list.order.join() === 'test:b,test:a');

  await pg.screenshot({path: OUT + '/steady-rows.png'});
  console.log('errors', errs); await b.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
